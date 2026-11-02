import mongoose from "mongoose";
import Agent from "../models/agent.model.js";
import TeamChat from "../models/teamChat.model.js";
import {
  findOrCreateTeamChat,
  resumeTeamTurn,
  runTeamTurn,
} from "../services/teamChat.service.js";
import { getCreditCost, hasEnoughCredits, insufficientCreditsResponse } from "../utils/credits.js";
import { saveConversation } from "../utils/conversation.js";

const HEARTBEAT_MS = 15 * 1000;

const validThreadId = (threadId) =>
  typeof threadId === "string" && threadId.trim().length >= 1 && threadId.length <= 100;

// Server-Sent Events over a POST response: "event: x\ndata: {...}\n\n"
const openStream = (res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Comment lines keep the connection open during long rate-limit waits
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": keep-alive\n\n");
  }, HEARTBEAT_MS);

  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`);
  };

  const close = () => {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  };

  return { send, close };
};

const findTeam = (userId, agentId) =>
  mongoose.isValidObjectId(agentId)
    ? Agent.findOne({ _id: agentId, userId, kind: "team", isActive: true })
    : null;

// Keep the history sidebar in sync with the team conversation
const syncConversation = async ({ chat, team, userMessage, reply }) => {
  await saveConversation({
    userId: chat.userId,
    threadId: chat.threadId,
    checkpointThreadId: `${chat.userId}:${team._id}:${chat.threadId}`,
    agent: team,
    kind: "team",
    userMessage,
    reply,
    pendingApproval: chat.pending?.interrupts ?? null,
  });
};

const lastReply = (chat) =>
  [...chat.messages].reverse().find((message) => message.role === "assistant" && message.kind !== "auto")?.content || "";

// POST /api/team-chat/message  { agentId, message, threadId? }  -> event stream
export const sendTeamMessage = async (req, res) => {
  const { agentId, message, threadId } = req.body;

  if (typeof message !== "string" || !message.trim() || message.length > 10000) {
    return res.status(400).json({ success: false, message: "Message must be 1-10000 characters." });
  }
  if (threadId !== undefined && !validThreadId(threadId)) {
    return res.status(400).json({ success: false, message: "Invalid threadId." });
  }

  const team = await findTeam(req.user._id, agentId);
  if (!team) {
    return res.status(404).json({ success: false, message: "Agent team not found." });
  }

  const cost = getCreditCost("agentChat");
  if (!hasEnoughCredits(req.user, cost)) {
    return insufficientCreditsResponse(res, cost);
  }

  const conversationId = threadId || new mongoose.Types.ObjectId().toString();
  const chat = await findOrCreateTeamChat({ userId: req.user._id, agentId: team._id, threadId: conversationId });

  if (chat.pending) {
    return res.status(409).json({ success: false, message: "A team member is waiting for your approval in this chat. Approve or reject it first." });
  }

  const { send, close } = openStream(res);
  send("start", { threadId: conversationId, members: team.members.map(({ memberId, name, tools }) => ({ memberId, name, tools })) });

  try {
    const result = await runTeamTurn({ team, chat, message: message.trim(), emit: send });
    await syncConversation({ chat, team, userMessage: message.trim(), reply: lastReply(chat) });
    send("done", { threadId: conversationId, paused: result.paused });
  } catch (error) {
    console.error("Team chat error:", error.message);
    send("error", { message: "The team could not finish. Please try again." });
  } finally {
    close();
  }
};

// POST /api/team-chat/approve  { agentId, threadId, approved }  -> event stream
export const approveTeamAction = async (req, res) => {
  const { agentId, threadId, approved } = req.body;

  if (!validThreadId(threadId) || typeof approved !== "boolean") {
    return res.status(400).json({ success: false, message: "threadId and approved are required." });
  }

  const team = await findTeam(req.user._id, agentId);
  if (!team) {
    return res.status(404).json({ success: false, message: "Agent team not found." });
  }

  if (approved && !hasEnoughCredits(req.user, getCreditCost("approval"))) {
    return insufficientCreditsResponse(res, getCreditCost("approval"));
  }

  // Atomically take the pending approval so a double click can't run it twice
  const chat = await TeamChat.findOneAndUpdate(
    { userId: req.user._id, agentId: team._id, threadId, pending: { $ne: null } },
    { $set: { pending: null } },
    { returnDocument: "before" }
  );

  if (!chat?.pending) {
    return res.status(409).json({ success: false, message: "Nothing is waiting for approval." });
  }

  const pending = chat.pending;
  chat.pending = null;

  const { send, close } = openStream(res);
  send("start", { threadId, members: team.members.map(({ memberId, name, tools }) => ({ memberId, name, tools })) });

  try {
    const result = await resumeTeamTurn({ team, chat, pending, approved, emit: send });
    await syncConversation({ chat, team, reply: lastReply(chat) });
    send("done", { threadId, paused: result.paused });
  } catch (error) {
    console.error("Team chat approval error:", error.message);
    send("error", { message: "Could not process your decision." });
  } finally {
    close();
  }
};
