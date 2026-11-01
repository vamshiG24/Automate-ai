import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import mongoose from "mongoose";
import { google } from "googleapis";
import jwt from "jsonwebtoken";

import IntegrationConnection from "../models/integration.model.js";
import { decrypt } from "../utils/encrypt.js";

const server = new McpServer({
  name: "automate-mcp-server",
  version: "1.0.0",
});

// ---------------------------------------------
// DATABASE CONNECTION
// ---------------------------------------------

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
}

// ---------------------------------------------
// BACKEND JWT VERIFICATION
// ---------------------------------------------

function verifyBackendToken(token) {
  if (!process.env.AUTOMATE_MCP_SECRET) {
    throw new Error("MCP authentication is not configured.");
  }

  if (!token) {
    throw new Error("Missing backend authentication token.");
  }

  const payload = jwt.verify(token, process.env.AUTOMATE_MCP_SECRET, {
    algorithms: ["HS256"],
    issuer: "automate-backend",
    audience: "automate-mcp",
  });

  if (
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    !payload.sub
  ) {
    throw new Error("Invalid backend identity.");
  }

  return payload.sub;
}

// ---------------------------------------------
// GOOGLE OAUTH CLIENT
// ---------------------------------------------

async function getGoogleOAuthClient(userId, requiredService) {
  await connectDatabase();

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REDIRECT_URI
  ) {
    throw new Error("Google OAuth environment variables are missing.");
  }

  const integration = await IntegrationConnection.findOne({
    userId,
    provider: "google",
    status: "connected",
    services: requiredService,
  }).select("+tokens.refreshToken");

  if (!integration?.tokens?.refreshToken) {
    throw new Error(
      `Google ${requiredService} is not connected or its refresh token is unavailable.`
    );
  }

  const refreshToken = decrypt(integration.tokens.refreshToken);

  const oauthClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauthClient.setCredentials({
    refresh_token: refreshToken,
  });

  return oauthClient;
}

// ---------------------------------------------
// HELPER: MCP ERROR RESPONSE
// ---------------------------------------------

function errorResponse(message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  };
}

// ---------------------------------------------
// HELPER: DECODE GMAIL MESSAGE BODY
// ---------------------------------------------

function decodeBase64Url(data = "") {
  if (!data) return "";

  return Buffer.from(data, "base64url").toString("utf8");
}

function getHeader(headers = [], name) {
  const header = headers.find(
    (item) => item.name?.toLowerCase() === name.toLowerCase()
  );

  return header?.value || "";
}

function extractMessageBody(payload) {
  if (!payload) return "";

  // Prefer plain text when available.
  if (
    payload.mimeType === "text/plain" &&
    payload.body?.data
  ) {
    return decodeBase64Url(payload.body.data);
  }

  // Search multipart email content.
  if (payload.parts?.length) {
    const plainPart = payload.parts.find(
      (part) =>
        part.mimeType === "text/plain" &&
        part.body?.data
    );

    if (plainPart) {
      return decodeBase64Url(plainPart.body.data);
    }

    for (const part of payload.parts) {
      const body = extractMessageBody(part);

      if (body) return body;
    }
  }

  // Fallback when only a single body exists.
  if (payload.body?.data) {
    const body = decodeBase64Url(payload.body.data);

    if (payload.mimeType === "text/html") {
      return body
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    }

    return body;
  }

  return "";
}



// ---------------------------------------------
// TOOL 1: CURRENT TIME
// ---------------------------------------------

server.registerTool(
  "get_current_time",
  {
    description:
      "Get the current date and time in UTC ISO format. Use this to resolve relative dates such as today and tomorrow.",
    inputSchema: z.object({}),
  },
  async () => ({
    content: [
      {
        type: "text",
        text: new Date().toISOString(),
      },
    ],
  })
);

// ---------------------------------------------
// TOOL 2: SEND EMAIL
// Existing functionality preserved
// ---------------------------------------------

server.registerTool(
  "send_email",
  {
    description:
      "Send an email through the authenticated user's connected Gmail account. Only execute after explicit user approval.",
    inputSchema: z.object({
      authToken: z.string().min(1),
      to: z.string().email(),
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(20000),
    }),
  },
  async ({ authToken, to, subject, body }) => {
    try {
      const userId = verifyBackendToken(authToken);

      const oauthClient = await getGoogleOAuthClient(userId, "gmail");

      const gmail = google.gmail({
        version: "v1",
        auth: oauthClient,
      });

      const encodedSubject = `=?UTF-8?B?${Buffer.from(
        subject,
        "utf8"
      ).toString("base64")}?=`;

      const rawEmail = [
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(body, "utf8").toString("base64"),
      ].join("\r\n");

      const encodedMessage = Buffer.from(rawEmail, "utf8").toString(
        "base64url"
      );

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Email sent successfully.",
              messageId: response.data.id,
              recipient: to,
              subject,
            }),
          },
        ],
      };
    } catch (error) {
      console.error("send_email failed:", error.message);

      return errorResponse(
        "Unable to send the email. Check the Gmail connection and server logs."
      );
    }
  }
);

// ---------------------------------------------
// TOOL 3: CREATE CALENDAR EVENT
// ---------------------------------------------

server.registerTool(
  "create_calendar_event",
  {
    description: `
Create an event in the authenticated user's primary Google Calendar.

Resolve relative dates using the current date and timezone.
Use a clear, concise event title.
If the user does not specify a duration, use a 30-minute default.
Use Asia/Kolkata as the default timezone unless the user's timezone is known.
Do not invent a meeting time when it is missing.
The backend must obtain authentication from its trusted JWT wrapper.
Only execute after explicit user approval.
`,
    inputSchema: z.object({
      authToken: z.string().min(1),

      summary: z.string().trim().min(1).max(200),

      description: z.string().trim().max(5000).optional(),

      startDateTime: z.string().datetime({
        offset: true,
      }),

      endDateTime: z.string().datetime({
        offset: true,
      }),

      timeZone: z.string().trim().min(1).default("Asia/Kolkata"),
    }),
  },
  async ({
    authToken,
    summary,
    description,
    startDateTime,
    endDateTime,
    timeZone,
  }) => {
    try {
      const userId = verifyBackendToken(authToken);

      const start = new Date(startDateTime);
      const end = new Date(endDateTime);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
      ) {
        return errorResponse("Invalid event date or time.");
      }

      if (end <= start) {
        return errorResponse(
          "The event end time must be later than its start time."
        );
      }

      if (start <= new Date()) {
        return errorResponse(
          "The event start time must be in the future."
        );
      }

      const oauthClient = await getGoogleOAuthClient(
        userId,
        "google_calendar"
      );

      const calendar = google.calendar({
        version: "v3",
        auth: oauthClient,
      });

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary,
          ...(description ? { description } : {}),
          start: {
            dateTime: start.toISOString(),
            timeZone,
          },
          end: {
            dateTime: end.toISOString(),
            timeZone,
          },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Calendar event created successfully.",
              event: {
                id: response.data.id,
                summary: response.data.summary,
                start: response.data.start,
                end: response.data.end,
                htmlLink: response.data.htmlLink,
              },
            }),
          },
        ],
      };
    } catch (error) {
      console.error(
        "create_calendar_event failed:",
        error.message
      );

      return errorResponse(
        "Unable to create the calendar event. Check the Google Calendar connection and server logs."
      );
    }
  }
);

// ---------------------------------------------
// TOOL 4: LIST CALENDAR EVENTS
// ---------------------------------------------

server.registerTool(
  "list_calendar_events",
  {
    description: `
Retrieve events from the authenticated user's primary Google Calendar.

Use get_current_time to resolve requests such as today or tomorrow.
Provide timeMin and timeMax as ISO date-time strings with timezone offsets.
For today's meetings, use the beginning and end of today in the user's timezone.
For tomorrow's meetings, use the beginning and end of tomorrow.
Return a maximum of 10 events by default.
This tool only reads events; it does not modify them.
`,
    inputSchema: z.object({
      authToken: z.string().min(1),

      timeMin: z.string().datetime({
        offset: true,
      }),

      timeMax: z.string().datetime({
        offset: true,
      }),

      maxResults: z.number().int().min(1).max(50).default(10),
    }),
  },
  async ({ authToken, timeMin, timeMax, maxResults }) => {
    try {
      const userId = verifyBackendToken(authToken);

      const start = new Date(timeMin);
      const end = new Date(timeMax);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        return errorResponse(
          "Invalid calendar date range. The end must be later than the start."
        );
      }

      const oauthClient = await getGoogleOAuthClient(
        userId,
        "google_calendar"
      );

      const calendar = google.calendar({
        version: "v3",
        auth: oauthClient,
      });

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = (response.data.items || []).map((event) => ({
        id: event.id,
        summary: event.summary || "(No title)",
        description: event.description || "",
        start: event.start?.dateTime || event.start?.date || null,
        end: event.end?.dateTime || event.end?.date || null,
        htmlLink: event.htmlLink || null,
        status: event.status,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              count: events.length,
              events,
            }),
          },
        ],
      };
    } catch (error) {
      console.error(
        "list_calendar_events failed:",
        error.message
      );

      return errorResponse(
        "Unable to retrieve calendar events. Check the Google Calendar connection and server logs."
      );
    }
  }
);


// ---------------------------------------------
// TOOL: LIST / SEARCH EMAILS
// ---------------------------------------------

server.registerTool(
  "list_emails",
  {
    description: `
List or search emails from the authenticated user's Gmail account.

Examples:
- Latest emails: query "in:inbox"
- Unread emails: query "is:unread"
- Emails from a sender: query "from:rahul@example.com"
- Search by subject: query "subject:invoice"
- Recent emails: query "newer_than:7d"
- Search all mail: query "in:anywhere invoice"

Returns message ID, sender, recipient, subject, date, snippet,
thread ID and unread status.

This tool is read-only and does not require approval.
`,
    inputSchema: z.object({
      authToken: z.string().min(1),

      query: z.string()
        .trim()
        .max(500)
        .default("in:inbox"),

      maxResults: z.number()
        .int()
        .min(1)
        .max(25)
        .default(10),
    }),
  },

  async ({ authToken, query, maxResults }) => {
    try {
      const userId = verifyBackendToken(authToken);

      const oauthClient = await getGoogleOAuthClient(
        userId,
        "gmail"
      );

      const gmail = google.gmail({
        version: "v1",
        auth: oauthClient,
      });

      // Fetch matching email IDs.
      const listResponse =
        await gmail.users.messages.list({
          userId: "me",
          q: query || "in:inbox",
          maxResults,
        });

      const messageRefs =
        listResponse.data.messages || [];

      // Fetch metadata for each matching email.
      const emails = await Promise.all(
        messageRefs.map(async (ref) => {
          const response =
            await gmail.users.messages.get({
              userId: "me",
              id: ref.id,
              format: "metadata",
              metadataHeaders: [
                "From",
                "To",
                "Subject",
                "Date",
              ],
            });

          const message = response.data;
          const headers =
            message.payload?.headers || [];

          return {
            id: message.id,
            threadId: message.threadId,

            from: getHeader(headers, "From"),
            to: getHeader(headers, "To"),

            subject:
              getHeader(headers, "Subject") ||
              "(No subject)",

            date: getHeader(headers, "Date"),

            snippet: message.snippet || "",

            unread: (
              message.labelIds || []
            ).includes("UNREAD"),
          };
        })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              query: query || "in:inbox",
              count: emails.length,

              nextPageToken:
                listResponse.data.nextPageToken || null,

              emails,
            }),
          },
        ],
      };
    } catch (error) {
      console.error(
        "list_emails failed:",
        error.message
      );

      return errorResponse(
        "Unable to list emails. Check the Gmail connection, read permissions, and server logs."
      );
    }
  }
);


// ---------------------------------------------
// TOOL: READ A SPECIFIC EMAIL
// ---------------------------------------------

server.registerTool(
  "read_email",
  {
    description: `
Read the full content of a specific email from the
authenticated user's connected Gmail account.

Use the messageId returned by list_emails.

Returns sender, recipient, CC, subject, date, body,
snippet and labels.

This tool is read-only. It does not send, delete, or
modify emails, and does not require approval.
`,
    inputSchema: z.object({
      authToken: z.string().min(1),

      messageId: z.string()
        .trim()
        .min(1),
    }),
  },

  async ({ authToken, messageId }) => {
    try {
      const userId = verifyBackendToken(authToken);

      const oauthClient = await getGoogleOAuthClient(
        userId,
        "gmail"
      );

      const gmail = google.gmail({
        version: "v1",
        auth: oauthClient,
      });

      const response =
        await gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        });

      const message = response.data;

      const headers =
        message.payload?.headers || [];

      const body = extractMessageBody(
        message.payload
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,

              email: {
                id: message.id,
                threadId: message.threadId,

                from: getHeader(headers, "From"),
                to: getHeader(headers, "To"),
                cc: getHeader(headers, "Cc"),

                subject:
                  getHeader(headers, "Subject") ||
                  "(No subject)",

                date: getHeader(headers, "Date"),

                snippet: message.snippet || "",

                body:
                  body ||
                  "(No readable text body found)",

                labels: message.labelIds || [],
              },
            }),
          },
        ],
      };
    } catch (error) {
      console.error(
        "read_email failed:",
        error.message
      );

      return errorResponse(
        "Unable to read this email. Check the Gmail connection, message ID, read permissions, and server logs."
      );
    }
  }
);

// ---------------------------------------------
// TOOL: PUBLISH IMAGE TO INSTAGRAM
// ---------------------------------------------

async function generateInstagramCaption({
  topic,
  imageDescription,
  hashtags = [],
}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is required when caption is not provided."
    );
  }

  const model =
    process.env.GROQ_MODEL || "openai/gpt-oss-120b";

  const hashtagText = hashtags.length
    ? hashtags
        .map((tag) => `#${String(tag).replace(/^#+/, "")}`)
        .join(" ")
    : "";

  const prompt = `
Write an engaging Instagram caption.

Topic: ${topic || "Not provided"}
Image description: ${
    imageDescription ||
    "Not provided. Do not assume what the image depicts."
  }
User hashtags: ${hashtagText || "None"}

Rules:
- Write naturally and keep the caption concise.
- Do not claim to see the image.
- Include relevant hashtags when appropriate.
- Do not add explanations or quotation marks.
- Return only the caption.
`;

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model,
      messages: [
        {
          role: "system",
          content:
            "You generate natural Instagram captions and relevant hashtags.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 250,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const generatedCaption =
    response.data?.choices?.[0]?.message?.content?.trim();

  if (!generatedCaption) {
    throw new Error(
      "AI did not return an Instagram caption."
    );
  }

  return generatedCaption.slice(0, 2200);
}

// Register Instagram publishing tool
server.registerTool(
  "publish_instagram_image",
  {
    description: `
Publish an image to the authenticated user's connected Instagram account.

Use this tool ONLY when the user explicitly requests an Instagram
post or asks to publish an image to Instagram.

Examples:
- Post this image on Instagram.
- Upload this image to my Instagram.
- Publish this image with a caption.

Do NOT use this tool when:
- The user only uploads an image.
- The user asks what an image contains.
- The user asks to explain or analyze an image.
- The user asks to describe an image.

For image understanding, use analyze_image instead.

Requirements:
- imageUrl must be a public HTTPS URL.
- Generate a caption if one is not provided.
- The application requires explicit user approval before publishing.
- Never claim success unless publishing is confirmed.
`,
    inputSchema: z.object({
      authToken: z.string().min(1),

      imageUrl: z
        .string()
        .url()
        .refine(
          (url) => url.startsWith("https://"),
          {
            message:
              "imageUrl must be a public HTTPS URL.",
          }
        ),

      caption: z
        .string()
        .trim()
        .max(2200)
        .optional(),

      topic: z
        .string()
        .trim()
        .max(300)
        .optional(),

      imageDescription: z
        .string()
        .trim()
        .max(1000)
        .optional(),

      hashtags: z
        .array(
          z.string().trim().min(1).max(100)
        )
        .max(30)
        .optional(),
    }),
  },

  async ({
    authToken,
    imageUrl,
    caption,
    topic,
    imageDescription,
    hashtags = [],
  }) => {
    try {
      // 1. Authenticate the backend user.
      const userId = verifyBackendToken(authToken);

      await connectDatabase();

      // 2. Find the connected Instagram account.
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
const instagramId = process.env.INSTAGRAM_ACCOUNT_ID;

if (!accessToken || !instagramId) {
  return errorResponse("Instagram credentials are missing.");
}

     


      // 5. Generate caption if the user did not provide one.
      let finalCaption = caption?.trim();

      if (!finalCaption) {
        finalCaption = await generateInstagramCaption({
          topic,
          imageDescription,
          hashtags,
        });
      } else if (hashtags.length > 0) {
        const formattedHashtags = hashtags
          .map(
            (tag) =>
              `#${tag.replace(/^#+/, "")}`
          )
          .join(" ");

        finalCaption =
          `${finalCaption}\n\n${formattedHashtags}`;
      }

      finalCaption = finalCaption.slice(0, 2200);

      // 6. Instagram Graph API configuration.
      const apiVersion =
  process.env.INSTAGRAM_GRAPH_VERSION || "v23.0";

const graphBaseUrl =
  `https://graph.facebook.com/${apiVersion}`;

      const requestConfig = {
        timeout: 30000,
      };

      // 7. Create the media container.
      const containerResponse = await axios.post(
       `${graphBaseUrl}/${instagramId}/media`,
        null,
        {
          ...requestConfig,
          params: {
            image_url: imageUrl,
            caption: finalCaption,
            access_token: accessToken,
          },
        }
      );

      const creationId =
        containerResponse.data?.id;

      if (!creationId) {
        throw new Error(
          "Instagram did not return a media container ID."
        );
      }

      // 8. Wait until Instagram finishes processing.
      let isReady = false;

      for (let attempt = 0; attempt < 10; attempt++) {
        const statusResponse = await axios.get(
          `${graphBaseUrl}/${creationId}`,
          {
            ...requestConfig,
            params: {
              fields: "status_code",
              access_token: accessToken,
            },
          }
        );

        const status =
          statusResponse.data?.status_code;

        if (status === "FINISHED") {
          isReady = true;
          break;
        }

        if (
          status === "ERROR" ||
          status === "EXPIRED"
        ) {
          throw new Error(
            `Instagram media processing failed: ${status}`
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 3000)
        );
      }

      if (!isReady) {
        return errorResponse(
          `Instagram is still processing the image. Container ID: ${creationId}. Check its status before retrying publication.`
        );
      }

      // 9. Publish the image.
      const publishResponse = await axios.post(
        `${graphBaseUrl}/${instagramId}/media_publish`,
        null,
        {
          ...requestConfig,
          params: {
            creation_id: creationId,
            access_token: accessToken,
          },
        }
      );

      // 10. Return the result to the AI agent.
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message:
                "Instagram image published successfully.",
              mediaId:
                publishResponse.data?.id || null,
             
              caption: finalCaption,
            }),
          },
        ],
      };
    } catch (error) {
      console.error(
        "publish_instagram_image failed:",
        error.response?.data || error.message
      );

      const apiMessage =
        error.response?.data?.error?.message;

      return errorResponse(
        apiMessage
          ? `Instagram publishing failed: ${apiMessage}`
          : `Unable to publish Instagram image: ${error.message}`
      );
    }
  }
);


// ---------------------------------------------
// TOOL: ANALYZE IMAGE (VISION)
// ---------------------------------------------



  // ---------------------------------------------
// TOOL: ANALYZE IMAGE (GOOGLE GEMINI VISION)
// ---------------------------------------------

server.registerTool(
  "analyze_image",
  {
   description: `
Analyze an image using the Google Gemini vision model.

Use this tool whenever the user uploads or provides an image
and asks a question about it, or simply wants to know what
the image contains.

Examples:
- What is in this image?
- Describe this image.
- Explain this screenshot.
- Read the text in this image.
- Explain this code screenshot.

IMPORTANT:
- Analyze the image and answer the user's question.
- If the user only uploads an image without a question,
  describe the image and its important visible details.
- Never suggest publishing the image to Instagram unless
  the user explicitly asks to publish or post it.
- This tool only analyzes images. It never publishes them.
`,

    inputSchema: z.object({
      imageUrl: z
        .string()
        .url()
        .refine((url) => url.startsWith("https://"), {
          message: "imageUrl must be a public HTTPS URL.",
        }),

      prompt: z
        .string()
        .trim()
        .min(1)
        .max(2000)
        .default("Describe this image clearly and accurately."),
    }),
  },

  async ({ imageUrl, prompt }) => {
    try {
      // 1. Check API key
      if (!process.env.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY is not configured.");
      }

      // 2. Validate image URL
      const parsedUrl = new URL(imageUrl);

      if (parsedUrl.protocol !== "https:") {
        throw new Error("Only HTTPS image URLs are allowed.");
      }

      // Block obvious local/internal hostnames
      const hostname = parsedUrl.hostname.toLowerCase();

      if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1"
      ) {
        throw new Error(
          "Local or internal image URLs are not allowed."
        );
      }

      // 3. Download image
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 20000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        maxRedirects: 3,
        validateStatus: (status) =>
          status >= 200 && status < 300,
      });

      // 4. Validate image format
      const contentTypeHeader =
        imageResponse.headers["content-type"] || "";

      const mimeType = contentTypeHeader
        .split(";")[0]
        .trim()
        .toLowerCase();

      const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];

      if (!allowedMimeTypes.includes(mimeType)) {
        throw new Error(
          `Unsupported image content type: ${
            mimeType || "unknown"
          }. Use JPEG, PNG, WEBP, or GIF.`
        );
      }

      // 5. Convert image to Base64
      const imageBuffer = Buffer.from(imageResponse.data);

      if (!imageBuffer.length) {
        throw new Error("The image URL returned an empty file.");
      }

      if (imageBuffer.length > 10 * 1024 * 1024) {
        throw new Error("Image size must be less than 10 MB.");
      }

      const base64Image = imageBuffer.toString("base64");

      // 6. Initialize Google Gemini
      const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_API_KEY,
      });

      const model =
        process.env.GEMINI_VISION_MODEL ||
        "gemini-2.5-flash";

      // 7. Analyze image using Gemini
      const response = await ai.models.generateContent({
        model,

        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  prompt ||
                  "Describe this image clearly and accurately. Only mention details supported by the image.",
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
      });

      // 8. Extract analysis
      const analysis = response.text?.trim();

      if (!analysis) {
        throw new Error(
          "Gemini returned an empty image analysis."
        );
      }

      console.log(
        "Image analysis completed successfully."
      );

      // 9. Return result to MCP client
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              analysis,
            }),
          },
        ],
      };
    } catch (error) {
      console.error(
        "Gemini image analysis failed:",
        error.response?.data || error.message
      );

      const apiMessage =
        error.response?.data?.error?.message;

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: apiMessage
              ? `Image analysis failed: ${apiMessage}`
              : `Unable to analyze image: ${error.message}`,
          },
        ],
      };
    }
  }

)
// ---------------------------------------------
// START MCP SERVER
// ---------------------------------------------

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("AutoMate MCP Server started successfully.");
}

main().catch((error) => {
  console.error("MCP Server Error:", error.message);
  process.exit(1);
});