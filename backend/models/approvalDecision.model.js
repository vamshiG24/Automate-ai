import mongoose from "mongoose";

// Every approve / reject / auto-approve decision. The risk engine learns
// from this history, and it is also the data for the safety evaluation.
const approvalDecisionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    toolName: {
      type: String,
      required: true,
    },

    // What the action targets: email recipient, "calendar" or "instagram"
    target: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },

    riskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },

    // Reason codes, e.g. ["recipient_from_untrusted_content"]
    riskFactors: [
      {
        type: String,
      },
    ],

    approved: {
      type: Boolean,
      required: true,
    },

    autoApproved: {
      type: Boolean,
      default: false,
    },

    source: {
      type: String,
      enum: ["chat", "team"],
      default: "chat",
    },
  },
  {
    timestamps: true,
  }
);

approvalDecisionSchema.index({ userId: 1, toolName: 1, target: 1 });

const ApprovalDecision = mongoose.model(
  "ApprovalDecision",
  approvalDecisionSchema
);

export default ApprovalDecision;
