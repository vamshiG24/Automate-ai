import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import { getChatGraph } from "../services/chatGraph.service.js";
import { deductCredits } from "../utils/deductCredits.js";

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

    const conversationId = threadId || randomUUID();

    // Isolate conversation memory by authenticated user.
    const scopedThreadId = `${req.user._id}:${conversationId}`;

    const graph = await getChatGraph();

    const result = await graph.invoke(
      {
        messages: [
          new HumanMessage(message.trim()),
        ],
      },
      {
        configurable: {
          thread_id: scopedThreadId,
        },
      }
    );
      
       await deductCredits({
      userId:req.user._id,
      credits: 5,
    });
    const lastMessage = result.messages.at(-1);

    return res.status(200).json({
      success: true,
      data: {
        threadId: conversationId,
        reply: lastMessage.content,
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