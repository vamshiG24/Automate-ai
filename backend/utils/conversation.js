import Conversation from "../models/conversation.model.js";

// Lines the frontend appends to image messages; not useful in a title
const IMAGE_META_LINE =
  /^(Image URL:|Image public ID:|Image description:|If I asked to publish)/i;

export const cleanUserText = (text = "") =>
  String(text)
    .split("\n")
    .filter((line) => !IMAGE_META_LINE.test(line.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

export const makeTitle = (text) => {
  const cleaned = cleanUserText(text);

  if (!cleaned) {
    return "Image chat";
  }

  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned;
};

const preview = (text = "") => {
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  return cleaned.length > 200 ? `${cleaned.slice(0, 197)}...` : cleaned;
};

// Create or update the sidebar entry for a thread. History is a
// convenience, so failures are logged instead of failing the chat.
export const saveConversation = async ({
  userId,
  threadId,
  checkpointThreadId,
  agent = null,
  userMessage,
  reply,
  pendingApproval = null,
}) => {
  try {
    const update = {
      $set: {
        checkpointThreadId,
        agentId: agent?._id ?? null,
        agentName: agent?.name ?? "",
        pendingApproval,
        lastMessage: preview(reply || cleanUserText(userMessage)),
      },
      $inc: {
        messageCount: (userMessage ? 1 : 0) + (reply ? 1 : 0),
      },
    };

    if (userMessage) {
      update.$setOnInsert = { title: makeTitle(userMessage) };
    }

    await Conversation.findOneAndUpdate({ userId, threadId }, update, {
      upsert: true,
      runValidators: true,
    });
  } catch (error) {
    console.error("Save conversation error:", error.message);
  }
};
