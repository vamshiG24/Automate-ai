import mongoose from "mongoose";

import {
  runAgentGraph,
  resumeAgentGraph,
} from "../services/agentGraph.service.js";

import Agent from "../models/agent.model.js";
import { deductCredits } from "../utils/deductCredits.js";
import {
  getCreditCost,
  hasEnoughCredits,
  insufficientCreditsResponse,
} from "../utils/credits.js";
import { saveConversation } from "../utils/conversation.js";
import { withRateLimitRetry } from "../services/rateLimitRetry.js";

const getScopedThreadId = ({ userId, agentId, threadId }) =>
  [userId.toString(), agentId.toString(), threadId].join(":");

const validateThreadId = (threadId) =>
  typeof threadId === "string" &&
  threadId.trim().length >= 1 &&
  threadId.length <= 100;

const getAuthenticatedUserId = (req) =>
  req.user?._id?.toString();

const formatError = (error) => {
  console.error("Agent controller error:", error.message);
};

export const chatWithAgent = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { agentId, message, threadId } = req.body;

    if (!mongoose.isValidObjectId(agentId)) {
      return res.status(400).json({
        success: false,
        message: "A valid agentId is required.",
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    if (message.length > 10000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 10000 characters.",
      });
    }

    if (threadId !== undefined && !validateThreadId(threadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid threadId.",
      });
    }

    const agent = await Agent.findOne({
      _id: agentId,
      userId,
      isActive: true,
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Active agent not found.",
      });
    }

    const cost = getCreditCost("agentChat");

    // Check credits before the agent runs any LLM call or tool
    if (!hasEnoughCredits(req.user, cost)) {
      return insufficientCreditsResponse(res, cost);
    }

    const conversationId =
      threadId || new mongoose.Types.ObjectId().toString();

    const scopedThreadId = getScopedThreadId({
      userId,
      agentId: agent._id,
      threadId: conversationId,
    });

    const result = await withRateLimitRetry(
      () =>
        runAgentGraph({
          agent,
          message: message.trim(),
          threadId: scopedThreadId,
          userId,
        }),
      { agent, threadId: scopedThreadId, userId, label: "Agent chat" }
    );

    if (result.interrupted) {
      await saveConversation({
        userId,
        threadId: conversationId,
        checkpointThreadId: scopedThreadId,
        agent,
        userMessage: message.trim(),
        pendingApproval: result.interrupts,
      });

      return res.status(202).json({
        success: true,
        data: {
          agentId: agent._id,
          agentName: agent.name,
          threadId: conversationId,
          requiresApproval: true,
          interrupts: result.interrupts,
        },
      });
    }
    const { remainingCredits } = await deductCredits({
      userId,
      credits: cost,
    });

    await saveConversation({
      userId,
      threadId: conversationId,
      checkpointThreadId: scopedThreadId,
      agent,
      userMessage: message.trim(),
      reply: result.reply,
    });

    return res.status(200).json({
      success: true,
      data: {
        agentId: agent._id,
        agentName: agent.name,
        threadId: conversationId,
        requiresApproval: false,
        reply: result.reply,
        model: result.model,
        autoApprovals: result.autoApprovals,
        remainingCredits,
      },
    });
  } catch (error) {
    formatError(error);

    return res.status(502).json({
      success: false,
      message: "Unable to generate an AI response. Please try again.",
    });
  }
};

export const approveEmail = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { agentId, threadId, approved } = req.body;

    if (!mongoose.isValidObjectId(agentId)) {
      return res.status(400).json({
        success: false,
        message: "A valid agentId is required.",
      });
    }

    if (!validateThreadId(threadId)) {
      return res.status(400).json({
        success: false,
        message: "A valid threadId is required.",
      });
    }

    if (typeof approved !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "approved must be a boolean.",
      });
    }

    const agent = await Agent.findOne({
      _id: agentId,
      userId,
      isActive: true,
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Active agent not found.",
      });
    }

    const cost = getCreditCost("approval");

    // Rejecting is free; approving runs the tool, so it needs credits
    if (approved && !hasEnoughCredits(req.user, cost)) {
      return insufficientCreditsResponse(res, cost);
    }

    const scopedThreadId = getScopedThreadId({
      userId,
      agentId: agent._id,
      threadId,
    });

    const result = await withRateLimitRetry(
      () =>
        resumeAgentGraph({
          agent,
          threadId: scopedThreadId,
          userId,
          approved,
        }),
      { agent, threadId: scopedThreadId, userId, label: "Agent approval" }
    );

    if (result.interrupted) {
      await saveConversation({
        userId,
        threadId,
        checkpointThreadId: scopedThreadId,
        agent,
        pendingApproval: result.interrupts,
      });

      return res.status(202).json({
        success: true,
        data: {
          agentId: agent._id,
          threadId,
          requiresApproval: true,
          interrupts: result.interrupts,
        },
      });
    }
    let remainingCredits = Number(req.user.credits ?? 0);

    if (approved) {
      ({ remainingCredits } = await deductCredits({
        userId,
        credits: cost,
      }));
    }

    await saveConversation({
      userId,
      threadId,
      checkpointThreadId: scopedThreadId,
      agent,
      reply: result.reply,
    });

    return res.status(200).json({
      success: true,
      data: {
        agentId: agent._id,
        threadId,
        requiresApproval: false,
        reply: result.reply,
        model: result.model,
        autoApprovals: result.autoApprovals,
        remainingCredits,
      },
    });
  } catch (error) {
    formatError(error);

    return res.status(500).json({
      success: false,
      message: "Unable to process email approval.",
    });
  }
};