import mongoose from "mongoose";

// A saved, user-reviewed team plan that runs on a schedule.
// Each run copies these steps into a new TeamRun, so the agents and their
// permissions are exactly what the user approved when saving it.
const planStepSchema = new mongoose.Schema(
  {
    stepId: { type: String, required: true },
    agentName: { type: String, required: true, maxlength: 60 },
    role: { type: String, default: "", maxlength: 300 },
    task: { type: String, required: true, maxlength: 1000 },
    capabilities: [{ type: String }],
    dependsOn: [{ type: String }],
  },
  { _id: false }
);

const automationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    instruction: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    steps: [planStepSchema],

    // Times are wall-clock times in Asia/Kolkata
    schedule: {
      frequency: {
        type: String,
        enum: ["daily", "weekdays", "weekly"],
        required: true,
      },
      time: {
        type: String,
        required: true,
        match: /^([01]\d|2[0-3]):[0-5]\d$/,
      },
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
        default: 1,
      },
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    nextRunAt: {
      type: Date,
      index: true,
    },

    lastRunAt: Date,

    lastRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeamRun",
      default: null,
    },

    // Why the last scheduled run did not start (empty when it did)
    lastNote: {
      type: String,
      default: "",
    },

    runCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

automationSchema.index({ enabled: 1, nextRunAt: 1 });

const Automation = mongoose.model("Automation", automationSchema);

export default Automation;
