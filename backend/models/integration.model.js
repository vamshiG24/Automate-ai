import mongoose from "mongoose";

const integrationConnectionSchema = new mongoose.Schema(
  {
    // AutoMate AI ka logged-in user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Authentication provider
    provider: {
      type: String,
      required: true,
      enum: ["google", "instagram"],
    },

    // Gmail, Calendar, Instagram etc.
    services: [
      {
        type: String,
        enum: [
          "gmail",
          "google_calendar",
          "instagram",
        ],
      },
    ],

    // Provider ka account identifier
    providerAccountId: {
      type: String,
      required: true,
    },

    // Connected account ki details
    account: {
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },

      username: {
        type: String,
        trim: true,
      },

      displayName: {
        type: String,
        trim: true,
      },
    },

    // OAuth tokens: encrypted values store honge
    tokens: {
      accessToken: {
        type: String,
        select: false,
      },

      refreshToken: {
        type: String,
        select: false,
      },

      expiresAt: {
        type: Date,
      },
    },

    // OAuth permissions
    scopes: [
      {
        type: String,
      },
    ],

    status: {
      type: String,
      enum: ["connected", "expired", "revoked", "error"],
      default: "connected",
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Same provider account ko ek user ke liye duplicate connect
// hone se prevent karega.
integrationConnectionSchema.index(
  {
    userId: 1,
    provider: 1,
    providerAccountId: 1,
  },
  {
    unique: true,
  }
);

const IntegrationConnection = mongoose.model(
  "IntegrationConnection",
  integrationConnectionSchema
);

export default IntegrationConnection;