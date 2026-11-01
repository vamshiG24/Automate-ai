import mongoose from "mongoose";

// One document per chat thread, used to build the history sidebar.
// The messages themselves live in the LangGraph checkpointer.
const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Thread id the frontend sends back
    threadId: {
      type: String,
      required: true,
    },

    // Server-side scoped id used by the LangGraph checkpointer
    checkpointThreadId: {
      type: String,
      required: true,
    },

    // null for normal chat without an agent
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },

    agentName: {
      type: String,
      default: "",
    },

    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "New chat",
    },

    lastMessage: {
      type: String,
      default: "",
      maxlength: 200,
    },

    messageCount: {
      type: Number,
      default: 0,
    },

    pinned: {
      type: Boolean,
      default: false,
    },

    // Approval card waiting for the user (email, calendar, Instagram)
    pendingApproval: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ userId: 1, threadId: 1 }, { unique: true });
conversationSchema.index({ userId: 1, pinned: -1, updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
