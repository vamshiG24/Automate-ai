
import { google } from "googleapis";
import axios from "axios";
import IntegrationConnection from "../models/integration.model.js";
import {
  createGoogleOAuthClient,
  GOOGLE_SCOPES,
} from "../config/googleOAuth.js";

import { encrypt, decrypt } from "../utils/encrypt.js";
import { signOAuthState, verifyOAuthState } from "../utils/oauthState.js";

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

    const state = signOAuthState(userId, "google-oauth");

    const url = createGoogleOAuthClient().generateAuthUrl({
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

    const userId = verifyOAuthState(state, "google-oauth");

    // New client per request so concurrent users never share credentials
    const oauthClient = createGoogleOAuthClient();
    const { tokens } = await oauthClient.getToken(code);

    oauthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauthClient,
    });

    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.id || !profile.email) {
      return res.status(400).send("Unable to identify Google account");
    }

    const filter = {
      userId,
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
      `${process.env.FRONTEND_URL}/integrations?google=connected`
    );
  } catch (error) {
    console.error("Google OAuth callback:", error.message);

    return res.redirect(
      `${process.env.FRONTEND_URL}/integrations?google=error`
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

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
];

// Read lazily so values are always taken after dotenv has loaded
const getInstagramConfig = () => ({
  appId: process.env.INSTAGRAM_APP_ID,
  appSecret: process.env.INSTAGRAM_APP_SECRET,
  configId: process.env.INSTAGRAM_CONFIG_ID,
  redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
  graphUrl: `https://graph.facebook.com/${
    process.env.INSTAGRAM_GRAPH_VERSION || "v23.0"
  }`,
});

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

    const { appId, appSecret, configId, redirectUri } = getInstagramConfig();

    if (!appId || !appSecret || !configId || !redirectUri) {
      return res.status(500).json({
        success: false,
        message: "Instagram OAuth environment variables are missing",
      });
    }

    const state = signOAuthState(userId, "instagram-oauth");

    const params = new URLSearchParams({
      client_id: appId,
      config_id: configId,
      display: "popup",
      override_default_response_type: "true",
      redirect_uri: redirectUri,
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
        `${process.env.FRONTEND_URL}/integrations?instagram=error`
      );
    }

    if (typeof code !== "string" || typeof state !== "string") {
      return res.status(400).send("Invalid Instagram OAuth callback");
    }

    const userId = verifyOAuthState(state, "instagram-oauth");
    const { appId, appSecret, redirectUri, graphUrl } = getInstagramConfig();

    // 1. Exchange the OAuth code for a short-lived user token
    const { data: shortLived } = await axios.get(
      `${graphUrl}/oauth/access_token`,
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
        timeout: 15000,
      }
    );

    // 2. Upgrade it to a long-lived user token (~60 days)
    const { data: longLived } = await axios.get(
      `${graphUrl}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLived.access_token,
        },
        timeout: 15000,
      }
    );

    // 3. Find the Facebook Page that has this user's Instagram business account
    const { data: pages } = await axios.get(`${graphUrl}/me/accounts`, {
      params: {
        fields: "id,name,access_token,instagram_business_account{id,username}",
        access_token: longLived.access_token,
      },
      timeout: 15000,
    });

    const page = pages.data?.find((item) => item.instagram_business_account);

    if (!page) {
      console.error("Instagram OAuth: no Page with a linked Instagram business account");

      return res.redirect(
        `${process.env.FRONTEND_URL}/integrations?instagram=no_business_account`
      );
    }

    const instagramAccount = page.instagram_business_account;

    const filter = {
      userId,
      provider: "instagram",
      providerAccountId: String(instagramAccount.id),
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
      username: instagramAccount.username,
      displayName: instagramAccount.username,
    };

    // Page tokens derived from a long-lived user token do not expire
    connection.tokens.accessToken = encrypt(page.access_token);
    connection.tokens.expiresAt = null;

    connection.metadata = { pageId: page.id, pageName: page.name };
    connection.scopes = INSTAGRAM_SCOPES;
    connection.status = "connected";
    connection.connectedAt = new Date();

    await connection.save();

    return res.redirect(
      `${process.env.FRONTEND_URL}/integrations?instagram=connected`
    );
  } catch (error) {
    console.error(
      "Instagram OAuth callback:",
      error.response?.data || error.message
    );

    return res.redirect(
      `${process.env.FRONTEND_URL}/integrations?instagram=error`
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
    }).select("+tokens.refreshToken");

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Google account is not connected",
      });
    }

    // Revoke access at Google too, not just in our database.
    // Best effort: a failed revoke should not block the disconnect.
    if (connection.tokens?.refreshToken) {
      try {
        await createGoogleOAuthClient().revokeToken(
          decrypt(connection.tokens.refreshToken)
        );
      } catch (revokeError) {
        console.warn("Google token revoke failed:", revokeError.message);
      }
    }

    await IntegrationConnection.deleteOne({
      _id: connection._id,
      userId,
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
