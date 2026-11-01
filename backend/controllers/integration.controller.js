
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import axios from "axios";
import IntegrationConnection from "../models/integration.model.js";
import {
  googleOAuthClient,
  GOOGLE_SCOPES,
} from "../config/googleOAuth.js";

import { encrypt } from "../utils/encrypt.js";

// Connect Google account
// Connect Google account
export const connectGoogle = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const state = jwt.sign(
      {
        userId: String(userId),
        purpose: "google-oauth",
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    const url = googleOAuthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_SCOPES,
      state,
    });

    return res.status(200).json({
      success: true,
      url,
    });
  } catch (error) {
    console.error("Connect Google:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to connect Google",
    });
  }
};

// Google OAuth callback
export const googleCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send("Google authorization was cancelled");
    }

    if (typeof code !== "string" || typeof state !== "string") {
      return res.status(400).send("Invalid OAuth callback");
    }

    const decoded = jwt.verify(state, process.env.JWT_SECRET);

    if (decoded.purpose !== "google-oauth" || !decoded.userId) {
      return res.status(400).send("Invalid OAuth state");
    }

    const { tokens } = await googleOAuthClient.getToken(code);

    googleOAuthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({
      version: "v2",
      auth: googleOAuthClient,
    });

    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.id || !profile.email) {
      return res.status(400).send("Unable to identify Google account");
    }

    const filter = {
      userId: decoded.userId,
      provider: "google",
      providerAccountId: profile.id,
    };

    let connection = await IntegrationConnection.findOne(filter)
      .select("+tokens.refreshToken +tokens.accessToken");

    if (!connection) {
      connection = new IntegrationConnection({
        ...filter,
        services: [],
        tokens: {},
      });
    }

    connection.services = [
      ...new Set([
        ...(connection.services || []),
        "gmail",
        "google_calendar",
      ]),
    ];

    connection.account = {
      ...connection.account?.toObject?.(),
      email: profile.email,
      displayName: profile.name || "",
    };

    connection.scopes = tokens.scope
      ? tokens.scope.split(" ")
      : GOOGLE_SCOPES;

    if (tokens.refresh_token) {
      connection.tokens.refreshToken = encrypt(tokens.refresh_token);
    }

    if (tokens.access_token) {
      connection.tokens.accessToken = encrypt(tokens.access_token);
    }

    if (tokens.expiry_date) {
      connection.tokens.expiresAt = new Date(tokens.expiry_date);
    }

    connection.status = "connected";
    connection.connectedAt = new Date();

    await connection.save();

    return res.redirect(
      `${process.env.FRONTEND_URL}/?google=connected`
    );
  } catch (error) {
    console.error("Google OAuth callback:", error.message);

    return res.status(500).send(
      "Google connection failed. Please try again."
    );
  }
};

// Get connected integrations
export const getIntegrations = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const integrations = await IntegrationConnection.find({
      userId,
      status: "connected",
    }).select("-tokens");

    const googleConnection = integrations.find(
      (item) => item.provider === "google"
    );

    const instagramConnection = integrations.find(
      (item) => item.provider === "instagram"
    );

    res.status(200).json({
      success: true,
      integrations: {
        gmail: {
          connected: googleConnection?.services.includes("gmail") || false,
          email: googleConnection?.account?.email || null,
        },
        googleCalendar: {
          connected:
            googleConnection?.services.includes("google_calendar") || false,
          email: googleConnection?.account?.email || null,
        },
        instagram: {
          connected:
            instagramConnection?.services.includes("instagram") || false,
          username: instagramConnection?.account?.username || null,
        },
      },
    });
  } catch (error) {
    console.error("Get integrations:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to fetch integrations",
    });
  }
};


const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const INSTAGRAM_CONFIG_ID = process.env.INSTAGRAM_CONFIG_ID;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;
const INSTAGRAM_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v23.0";

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_messages",
];

// Start Instagram OAuth
export const connectInstagram = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    if (
      !INSTAGRAM_APP_ID ||
      !INSTAGRAM_CONFIG_ID ||
      !INSTAGRAM_REDIRECT_URI ||
      !process.env.JWT_SECRET
    ) {
      return res.status(500).json({
        success: false,
        message: "Instagram OAuth environment variables are missing",
      });
    }

    const state = jwt.sign(
      {
        userId: String(userId),
        purpose: "instagram-oauth",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m",
      }
    );

const params = new URLSearchParams({
  client_id: INSTAGRAM_APP_ID,
  config_id: INSTAGRAM_CONFIG_ID,
  display: "popup",
  override_default_response_type: "true",
  redirect_uri: INSTAGRAM_REDIRECT_URI,
  response_type: "code",
  state,
  prompt: "login",
});

const url = `https://www.facebook.com/dialog/oauth?${params.toString()}`;

    return res.status(200).json({
      success: true,
      url,
    });
  } catch (error) {
    console.error("Connect Instagram:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to connect Instagram",
    });
  }
};

// Instagram OAuth callback
export const instagramCallback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error(
        "Instagram authorization error:",
        error_description || error
      );

      return res.redirect(
        `${process.env.FRONTEND_URL}/?instagram=error`
      );
    }

    if (typeof code !== "string" || typeof state !== "string") {
      return res.status(400).send("Invalid Instagram OAuth callback");
    }

    const decoded = jwt.verify(state, process.env.JWT_SECRET);

    if (decoded.purpose !== "instagram-oauth" || !decoded.userId) {
      return res.status(400).send("Invalid Instagram OAuth state");
    }

    // Exchange authorization code for a short-lived access token.
    // Exchange OAuth code for Meta access token

 // Verify the fixed Instagram account using its account ID.
const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

if (!accountId || !accessToken) {
  throw new Error("Instagram account credentials are missing.");
}

const profileResponse = await axios.get(
  `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/${accountId}`,
  {
    params: {
      fields: "id,username",
      access_token: accessToken,
    },
    timeout: 15000,
  }
);

const profile = profileResponse.data;

const filter = {
  userId: decoded.userId,
  provider: "instagram",
  providerAccountId: String(profile.id),
};

let connection = await IntegrationConnection.findOne(filter)
  .select("+tokens.accessToken");

if (!connection) {
  connection = new IntegrationConnection({
    ...filter,
    services: [],
    tokens: {},
  });
}

connection.services = [
  ...new Set([...(connection.services || []), "instagram"]),
];

connection.account = {
  ...connection.account?.toObject?.(),
  username: profile.username,
  displayName: profile.username,
};

connection.tokens.accessToken = encrypt(accessToken);
connection.tokens.expiresAt = null;

connection.scopes = INSTAGRAM_SCOPES;
connection.status = "connected";
connection.connectedAt = new Date();

await connection.save();
    return res.redirect(
      `${process.env.FRONTEND_URL}/?instagram=connected`
    );
  } catch (error) {
    console.error(
      "Instagram OAuth callback:",
      error.response?.data || error.message
    );

    return res.redirect(
      `${process.env.FRONTEND_URL}/?instagram=error`
    );
  }
};

// Get Instagram connection status
export const getInstagramStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const connection = await IntegrationConnection.findOne({
      userId,
      provider: "instagram",
      services: "instagram",
      status: "connected",
    }).select("-tokens");

    return res.status(200).json({
      success: true,
      instagram: {
        connected: Boolean(connection),
        username: connection?.account?.username || null,
        connectedAt: connection?.connectedAt || null,
      },
    });
  } catch (error) {
    console.error("Get Instagram status:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch Instagram status",
    });
  }
};

// Disconnect Instagram
export const disconnectInstagram = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const connection = await IntegrationConnection.findOne({
      userId,
      provider: "instagram",
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Instagram account is not connected",
      });
    }

    await IntegrationConnection.deleteOne({
      _id: connection._id,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Instagram disconnected successfully",
    });
  } catch (error) {
    console.error("Disconnect Instagram:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to disconnect Instagram",
    });
  }
};

export const disconnectGoogle = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const connection = await IntegrationConnection.findOne({
      userId,
      provider: "google",
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Google account is not connected",
      });
    }

    await IntegrationConnection.deleteOne({
      _id: connection._id,
    });

    return res.status(200).json({
      success: true,
      message: "Google account disconnected successfully",
    });
  } catch (error) {
    console.error("Disconnect Google Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to disconnect Google account",
    });
  }
};