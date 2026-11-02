import mongoose from "mongoose";

// A member of an "agent team": its own job and its own tools (least privilege)
const teamMemberSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },

    // The specific work this member does
    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    tools: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { _id: false }
);

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

    // "single" = one agent, "team" = several members you chat with together
    kind: {
      type: String,
      enum: ["single", "team"],
      default: "single",
    },

    // Only for kind "team" (2-5 members)
    members: [teamMemberSchema],

    // "route" = a coordinator picks only the members a message needs,
    // "pipeline" = every message goes through all members in order
    teamMode: {
      type: String,
      enum: ["route", "pipeline"],
      default: "route",
    },

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