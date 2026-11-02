import mongoose from "mongoose";

// One continuous conversation with an agent team. Holds the shared memory
// (all messages, with which member wrote them) and any paused approval.
const teamMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    // Empty for user messages
    memberId: { type: String, default: "" },
    memberName: { type: String, default: "" },

    content: {
      type: String,
      default: "",
    },

    // "auto" = auto-approval note, "error" = a member could not finish
    kind: {
      type: String,
      default: "",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const teamChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },

    // Conversation id the frontend uses
    threadId: {
      type: String,
      required: true,
    },

    messages: [teamMessageSchema],

    // A member waiting for approval, plus the rest of this turn's plan:
    // { queue, index, memberId, threadId, turnId, userMessage, interrupts }
    pending: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

teamChatSchema.index({ userId: 1, threadId: 1 }, { unique: true });

const TeamChat = mongoose.model("TeamChat", teamChatSchema);

export default TeamChat;
