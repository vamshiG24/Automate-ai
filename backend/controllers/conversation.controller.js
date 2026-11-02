import Agent from "../models/agent.model.js";
import Conversation from "../models/conversation.model.js";
import { getCheckpointer } from "../config/langgraph-checkpointer.js";

const validateThreadId = (threadId) =>
  typeof threadId === "string" &&
  threadId.trim().length >= 1 &&
  threadId.length <= 100;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const IMAGE_URL_LINE = /^Image URL:\s*(\S+)/im;
const IMAGE_META_LINE =
  /^(Image URL:|Image public ID:|Image description:|Image analysis|If I asked to publish)/i;

const contentToText = (content) => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("");
  }

  return "";
};

const getMessageType = (message) =>
  message?._getType?.() || message?.getType?.() || message?.type;

// Turn LangGraph checkpoint messages into simple chat bubbles.
// Tool calls, tool results and system prompts are hidden.
const toChatMessages = (messages = []) =>
  messages.flatMap((message) => {
    const type = getMessageType(message);
    const text = contentToText(message.content).trim();

    if (type === "human") {
      const imageUrl = text.match(IMAGE_URL_LINE)?.[1] || "";
      const visibleText = text
        .split("\n")
        .filter((line) => !IMAGE_META_LINE.test(line.trim()))
        .join("\n")
        .trim();

      return [{ role: "user", content: visibleText, imageUrl }];
    }

    if (type === "ai" && text) {
      return [{ role: "assistant", content: text }];
    }

    return [];
  });

const toListItem = (conversation) => ({
  threadId: conversation.threadId,
  title: conversation.title,
  agentId: conversation.agentId,
  agentName: conversation.agentName,
  lastMessage: conversation.lastMessage,
  messageCount: conversation.messageCount,
  pinned: conversation.pinned,
  hasPendingApproval: Boolean(conversation.pendingApproval?.length),
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

// GET /api/conversations?search=
export const getConversations = async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    const { search } = req.query;

    if (typeof search === "string" && search.trim()) {
      filter.title = {
        $regex: escapeRegex(search.trim().slice(0, 100)),
        $options: "i",
      };
    }

    const conversations = await Conversation.find(filter)
      .sort({ pinned: -1, updatedAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      conversations: conversations.map(toListItem),
    });
  } catch (error) {
    console.error("Get conversations error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversations.",
    });
  }
};

// GET /api/conversations/:threadId
export const getConversationById = async (req, res) => {
  try {
    const { threadId } = req.params;

    if (!validateThreadId(threadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid threadId.",
      });
    }

    const conversation = await Conversation.findOne({
      userId: req.user._id,
      threadId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const checkpointer = await getCheckpointer();
    const tuple = await checkpointer.getTuple({
      configurable: {
        thread_id: conversation.checkpointThreadId,
        checkpoint_ns: "",
      },
    });

    const agentExists = conversation.agentId
      ? Boolean(
          await Agent.exists({
            _id: conversation.agentId,
            userId: req.user._id,
          })
        )
      : true;

    return res.status(200).json({
      success: true,
      conversation: {
        ...toListItem(conversation),
        agentDeleted: !agentExists,
        pendingApproval: conversation.pendingApproval,
        messages: toChatMessages(tuple?.checkpoint?.channel_values?.messages),
      },
    });
  } catch (error) {
    console.error("Get conversation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load conversation.",
    });
  }
};

// PATCH /api/conversations/:threadId  { title?, pinned? }
export const updateConversation = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { title, pinned } = req.body;
    const updates = {};

    if (!validateThreadId(threadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid threadId.",
      });
    }

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim() || title.length > 120) {
        return res.status(400).json({
          success: false,
          message: "Title must be 1-120 characters.",
        });
      }

      updates.title = title.trim();
    }

    if (pinned !== undefined) {
      if (typeof pinned !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "pinned must be a boolean.",
        });
      }

      updates.pinned = pinned;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    // timestamps: false so renaming/pinning doesn't reorder the list
    const conversation = await Conversation.findOneAndUpdate(
      { userId: req.user._id, threadId },
      { $set: updates },
      { returnDocument: "after", runValidators: true, timestamps: false }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    return res.status(200).json({
      success: true,
      conversation: toListItem(conversation),
    });
  } catch (error) {
    console.error("Update conversation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update conversation.",
    });
  }
};

// DELETE /api/conversations/:threadId
export const deleteConversation = async (req, res) => {
  try {
    const { threadId } = req.params;

    if (!validateThreadId(threadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid threadId.",
      });
    }

    const conversation = await Conversation.findOneAndDelete({
      userId: req.user._id,
      threadId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    // Also remove the stored LangGraph memory for this thread
    const checkpointer = await getCheckpointer();
    await checkpointer.deleteThread(conversation.checkpointThreadId);

    return res.status(200).json({
      success: true,
      message: "Conversation deleted.",
    });
  } catch (error) {
    console.error("Delete conversation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete conversation.",
    });
  }
};
