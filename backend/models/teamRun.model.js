import mongoose from "mongoose";

// One step = one specialist agent created by the Planner
const teamStepSchema = new mongoose.Schema(
  {
    stepId: {
      type: String,
      required: true,
    },

    agentName: {
      type: String,
      required: true,
      maxlength: 60,
    },

    role: {
      type: String,
      default: "",
      maxlength: 300,
    },

    task: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    // Least privilege: only these capabilities are given to this agent
    capabilities: [
      {
        type: String,
      },
    ],

    // Steps whose output this step receives
    dependsOn: [
      {
        type: String,
      },
    ],

    status: {
      type: String,
      enum: [
        "pending",
        "running",
        "waiting_approval",
        "completed",
        "failed",
        "skipped",
      ],
      default: "pending",
    },

    output: {
      type: String,
      default: "",
    },

    error: {
      type: String,
      default: "",
    },

    // Approval card waiting for the user (same shape as chat interrupts)
    interrupts: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    autoApprovals: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },

    checkpointThreadId: {
      type: String,
      default: "",
    },

    startedAt: Date,
    finishedAt: Date,
  },
  { _id: false }
);

const teamRunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    instruction: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    title: {
      type: String,
      default: "Team run",
      maxlength: 120,
    },

    // Planner's explanation of how it split the work
    reasoning: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: [
        "planned",
        "running",
        "waiting_approval",
        "completed",
        "failed",
      ],
      default: "planned",
    },

    steps: [teamStepSchema],

    creditsUsed: {
      type: Number,
      default: 0,
    },

    error: {
      type: String,
      default: "",
    },

    finishedAt: Date,
  },
  {
    timestamps: true,
  }
);

teamRunSchema.index({ userId: 1, createdAt: -1 });

const TeamRun = mongoose.model("TeamRun", teamRunSchema);

export default TeamRun;
