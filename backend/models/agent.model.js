import mongoose from "mongoose";

const agentSchema = new mongoose.Schema(
  {
    // Agent owner
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Basic information
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
      maxlength: 500,
    },

    // Agent behavior
    instructions: {
      type: String,
      required: true,
      trim: true,
    },

    // LLM configuration
    provider: {
      type: String,
      enum: ["groq"],
      default: "groq",
    },

    model: {
      type: String,
      default: "openai/gpt-oss-120b",
    },

    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2,
    },

    // Agent capabilities
    tools: [
      {
        type: String,
        trim: true,
      },
    ],

    // Connected knowledge bases
    knowledgeBases: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "KnowledgeBase",
      },
    ],

    // Agent status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);



const Agent = mongoose.model("Agent", agentSchema);

export default Agent;