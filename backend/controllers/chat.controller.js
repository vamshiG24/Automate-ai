import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import { getChatGraph } from "../services/chatGraph.service.js";
import { deductCredits } from "../utils/deductCredits.js";
import {
  getCreditCost,
  hasEnoughCredits,
  insufficientCreditsResponse,
} from "../utils/credits.js";
import { cleanUserText, saveConversation } from "../utils/conversation.js";
import { analyzeImageForChat, findImageUrl } from "../services/imageAnalysis.service.js";

export const chatWithAI = async (req, res) => {
  try {
    const { message, threadId } = req.body;

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

    if (
      threadId !== undefined &&
      (
        typeof threadId !== "string" ||
        threadId.length < 1 ||
        threadId.length > 100
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid threadId.",
      });
    }

    const cost = getCreditCost("chat");

    // Check credits before spending any LLM quota
    if (!hasEnoughCredits(req.user, cost)) {
      return insufficientCreditsResponse(res, cost);
    }

    const conversationId = threadId || randomUUID();

    // Isolate conversation memory by authenticated user.
    const scopedThreadId = `${req.user._id}:${conversationId}`;

    const graph = await getChatGraph();

    // Attached image: describe it with the vision tool first, so the
    // text-only chat model can answer questions about it
    let modelMessage = message.trim();
    const imageUrl = findImageUrl(modelMessage);

    if (imageUrl) {
      let analysis;
      try {
        analysis = await analyzeImageForChat(imageUrl, cleanUserText(modelMessage));
      } catch (error) {
        console.error("Chat image analysis error:", error.message);
        analysis = `(The image could not be analyzed: ${error.message}. Tell the user honestly.)`;
      }
      modelMessage += `\nImage analysis (from a vision model, use it to answer): ${String(analysis).replace(/\s+/g, " ").trim()}`;
    }

    const result = await graph.invoke(
      {
        messages: [
          new HumanMessage(modelMessage),
        ],
      },
      {
        configurable: {
          thread_id: scopedThreadId,
        },
      }
    );

    const { remainingCredits } = await deductCredits({
      userId: req.user._id,
      credits: cost,
    });

    const lastMessage = result.messages.at(-1);

    await saveConversation({
      userId: req.user._id,
      threadId: conversationId,
      checkpointThreadId: scopedThreadId,
      userMessage: message.trim(),
      reply: lastMessage.content,
    });

    return res.status(200).json({
      success: true,
      data: {
        threadId: conversationId,
        reply: lastMessage.content,
        remainingCredits,
      },
    });
  } catch (error) {
    console.error("Normal chat error:", error);

    return res.status(502).json({
      success: false,
      message: "Unable to generate an AI response.",
    });
  }
};
