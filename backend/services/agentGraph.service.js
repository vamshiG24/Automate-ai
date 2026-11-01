import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
  interrupt,
  Command,
} from "@langchain/langgraph";

import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGroq } from "@langchain/groq";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import * as z from "zod/v4";
import jwt from "jsonwebtoken";

import { getCheckpointer } from "../config/langgraph-checkpointer.js";
import { getMCPTools } from "../mcp/langgraph-mcp.js";

const SUPPORTED_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

// --------------------------------------------------
// FIND MCP TOOL
// --------------------------------------------------

const findTool = (tools, names) =>
  tools.find((tool) => names.includes(tool.name));


// --------------------------------------------------
// CHECK EXPLICIT INSTAGRAM PUBLISH INTENT
// --------------------------------------------------

const getUserIntentText = (message) =>
  typeof message === "string"
    ? message.split(/\n\s*Image URL:/i)[0].trim()
    : "";
 
const isExplicitInstagramPublishRequest = (message) => {
  const text = getUserIntentText(message).toLowerCase();
 
  if (!text) return false;
 
  const mentionsInstagram = /\b(instagram|insta|ig)\b/.test(text);
 
  const requestsPublishing =
    /\b(post(ing)?|publish(ing)?|share|upload)\b/.test(text);
 
  if (!mentionsInstagram || !requestsPublishing) return false;
 
  // "don't post", "without posting", "only caption" => publish nahi
  const negated =
    /\b(don'?t|do not|dont|never|without|not)\b[^.\n]{0,25}\b(post(ing)?|publish(ing)?|share|upload)\b/.test(
      text
    ) || /\bonly\b[^.\n]{0,15}\b(caption|hashtags?)\b/.test(text);
 
  return !negated;
};
// --------------------------------------------------
// GENERATE AUTH TOKEN
// --------------------------------------------------

const makeAuthToken = (userId) =>
  jwt.sign({}, process.env.AUTOMATE_MCP_SECRET, {
    algorithm: "HS256",
    subject: String(userId),
    expiresIn: "2m",
    issuer: "automate-backend",
    audience: "automate-mcp",
  });

// --------------------------------------------------
// INVOKE MCP TOOL
// --------------------------------------------------

const invokeMcpTool = async (tool, args) => {
  if (!tool) {
    throw new Error("Requested MCP tool is not available.");
  }

  const result = await tool.invoke(args);

  if (result?.isError) {
    const message = Array.isArray(result.content)
      ? result.content.map((item) => item.text || "").join("\n")
      : "MCP tool failed.";

    throw new Error(message || "MCP tool failed.");
  }

  return typeof result === "string"
    ? result
    : JSON.stringify(result);
};

// --------------------------------------------------
// CREATE AGENT GRAPH
// --------------------------------------------------

const createAgentGraph = async (agent, userId) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  if (!userId) {
    throw new Error("Authenticated userId is required.");
  }

  if (!process.env.AUTOMATE_MCP_SECRET) {
    throw new Error("MCP authentication is not configured.");
  }

  const modelName = agent.model || "openai/gpt-oss-120b";

  if (!SUPPORTED_MODELS.includes(modelName)) {
    throw new Error("Unsupported Groq model.");
  }

  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: modelName,
    temperature: agent.temperature ?? 0.7,
    maxRetries: 2,
    timeout: 30000,
  });

  // --------------------------------------------------
  // LOAD MCP TOOLS
  // --------------------------------------------------

  const mcpTools = await getMCPTools();

  console.log(
    "Loaded MCP tools:",
    mcpTools.map((tool) => tool.name)
  );

  // --------------------------------------------------
  // FIND INDIVIDUAL MCP TOOLS
  // --------------------------------------------------

  const sendEmailMcpTool = findTool(mcpTools, [
    "automate_send_email",
    "send_email",
  ]);

  const createCalendarMcpTool = findTool(mcpTools, [
    "automate_create_calendar_event",
    "create_calendar_event",
  ]);

  const listCalendarMcpTool = findTool(mcpTools, [
    "automate_list_calendar_events",
    "list_calendar_events",
  ]);

  const listEmailsMcpTool = findTool(mcpTools, [
    "automate_list_emails",
    "list_emails",
  ]);

  const readEmailMcpTool = findTool(mcpTools, [
    "automate_read_email",
    "read_email",
  ]);

  const publishInstagramImageMcpTool = findTool(mcpTools, [
    "automate_publish_instagram_image",
    "publish_instagram_image",
  ]);
const analyzeImageMcpTool = findTool(mcpTools, [
  "automate_analyze_image",
  "analyze_image",
]);
  // --------------------------------------------------
  // REMOVE RAW MCP TOOLS
  // --------------------------------------------------

  const protectedToolNames = new Set([
    "automate_send_email",
    "send_email",

    "automate_create_calendar_event",
    "create_calendar_event",

    "automate_list_calendar_events",
    "list_calendar_events",

    "automate_list_emails",
    "list_emails",

    "automate_read_email",
    "read_email",

    "automate_publish_instagram_image",
    "publish_instagram_image",

    "automate_analyze_image",
"analyze_image",
  ]);

  const securedTools = mcpTools.filter(
    (tool) => !protectedToolNames.has(tool.name)
  );

  // --------------------------------------------------
  // SEND EMAIL TOOL
  // --------------------------------------------------

  if (sendEmailMcpTool) {
    securedTools.push(
      new DynamicStructuredTool({
        name: "send_email",

        description: `
Send an email using the authenticated user's connected Gmail account.

Infer a suitable email subject and body from the user's request.

If the user says "send an email and say hello":
- Subject: Hello
- Body: hello

Ask for the recipient email only if it is missing and cannot be
inferred from the conversation.

Never ask for authentication tokens, API keys, passwords, or user IDs.

The application will request explicit approval before sending the email.
`,

        schema: z.object({
          to: z
            .string()
            .email()
            .describe("Recipient email address"),

          subject: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .describe("Email subject"),

          body: z
            .string()
            .trim()
            .min(1)
            .max(20000)
            .describe("Email body"),
        }),

        func: async ({ to, subject, body }) => {
          const authToken = makeAuthToken(userId);

          return invokeMcpTool(sendEmailMcpTool, {
            authToken,
            to,
            subject,
            body,
          });
        },
      })
    );
  }

  // --------------------------------------------------
  // CREATE CALENDAR EVENT TOOL
  // --------------------------------------------------

  if (createCalendarMcpTool) {
    securedTools.push(
      new DynamicStructuredTool({
        name: "create_calendar_event",

        description: `
Create an event in the authenticated user's primary Google Calendar.

Infer the title and description from the user's request.

Date and time rules:
- Interpret today, tomorrow, and weekday references using the current
  date and time supplied in the conversation.
- Default timezone: Asia/Kolkata.
- If duration is missing, use 30 minutes.
- Use ISO 8601 date-time strings with explicit timezone offsets.
- If an essential meeting time is missing and cannot be inferred,
  ask the user instead of inventing a time.

The application requires explicit approval before creating an event.
`,

        schema: z.object({
          summary: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .describe("Calendar event title"),

          description: z
            .string()
            .trim()
            .max(5000)
            .optional()
            .describe("Event description"),

          startDateTime: z
            .string()
            .datetime({ offset: true })
            .describe(
              "Event start in ISO 8601 with timezone offset"
            ),

          endDateTime: z
            .string()
            .datetime({ offset: true })
            .describe(
              "Event end in ISO 8601 with timezone offset"
            ),

          timeZone: z
            .string()
            .trim()
            .min(1)
            .default("Asia/Kolkata")
            .describe("IANA timezone"),
        }),

        func: async (args) => {
          const authToken = makeAuthToken(userId);

          return invokeMcpTool(createCalendarMcpTool, {
            authToken,
            ...args,
          });
        },
      })
    );
  }

  // --------------------------------------------------
  // LIST CALENDAR EVENTS TOOL
  // --------------------------------------------------

  if (listCalendarMcpTool) {
    securedTools.push(
      new DynamicStructuredTool({
        name: "list_calendar_events",

        description: `
Retrieve events from the authenticated user's primary Google Calendar.

Examples:
- "What are my meetings today?"
- "Show tomorrow's events."
- "What meetings do I have this week?"

Infer the requested date range using Asia/Kolkata unless the user
specifies another timezone.

Use ISO 8601 date-time strings with explicit timezone offsets.
Use maxResults 10 by default.

This is a read-only action and does not require approval.
`,

        schema: z.object({
          timeMin: z
            .string()
            .datetime({ offset: true })
            .describe("Start of the requested date range"),

          timeMax: z
            .string()
            .datetime({ offset: true })
            .describe("End of the requested date range"),

          maxResults: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(10),
        }),

        func: async (args) => {
          const authToken = makeAuthToken(userId);

          return invokeMcpTool(listCalendarMcpTool, {
            authToken,
            ...args,
          });
        },
      })
    );
  }

  // --------------------------------------------------
  // LIST / SEARCH EMAILS
  // --------------------------------------------------

  if (listEmailsMcpTool) {
    securedTools.push(
      new DynamicStructuredTool({
        name: "list_emails",

        description: `
Search or list emails from the authenticated user's connected Gmail.

Examples:
- Show my latest emails.
- Show unread emails.
- Find emails from a specific sender.
- Find emails about an invoice.

Use Gmail search syntax:
- in:inbox
- is:unread
- from:someone@example.com
- subject:invoice
- newer_than:7d

Rules:
- For latest inbox emails, use "in:inbox".
- For unread emails, use "is:unread".
- Use maxResults 10 by default.
- This is read-only and does not require approval.
- Never invent email results.
`,

        schema: z.object({
          query: z
            .string()
            .trim()
            .max(500)
            .optional()
            .default("")
            .describe("Gmail search query"),

          maxResults: z
            .number()
            .int()
            .min(1)
            .max(25)
            .optional()
            .default(10)
            .describe("Maximum number of emails"),
        }),

        func: async ({ query, maxResults }) => {
          const authToken = makeAuthToken(userId);

          return invokeMcpTool(listEmailsMcpTool, {
            authToken,
            query: query || "in:inbox",
            maxResults,
          });
        },
      })
    );
  }

  // --------------------------------------------------
  // READ SPECIFIC EMAIL
  // --------------------------------------------------

  if (readEmailMcpTool) {
    securedTools.push(
      new DynamicStructuredTool({
        name: "read_email",

        description: `
Read the full content of a specific email from the authenticated
user's connected Gmail account.

Use the messageId returned by list_emails.

Workflow:
1. If the email ID is unknown, call list_emails first.
2. Select the relevant email from the results.
3. Call read_email with its messageId.
4. Summarize the actual retrieved content.

This is read-only and does not require approval.
Never invent email content.
`,

        schema: z.object({
          messageId: z
            .string()
            .trim()
            .min(1)
            .describe("Gmail message ID"),
        }),

        func: async ({ messageId }) => {
          const authToken = makeAuthToken(userId);

          return invokeMcpTool(readEmailMcpTool, {
            authToken,
            messageId,
          });
        },
      })
    );
  }

  // --------------------------------------------------
  // PUBLISH INSTAGRAM IMAGE TOOL
  // --------------------------------------------------

// --------------------------------------------------
// ANALYZE IMAGE TOOL
// --------------------------------------------------

if (analyzeImageMcpTool) {
  securedTools.push(
    new DynamicStructuredTool({
      name: "analyze_image",

      description: `
Analyze an image using the vision model.

Use this tool when the user asks to explain, describe,
inspect, or understand an image.

Pass the publicly accessible image URL and the user's question.
Return the actual analysis from the image, not guesses based on its URL.
`,

      schema: z.object({
        imageUrl: z
          .string()
          .url()
          .describe("Publicly accessible image URL"),

        prompt: z
          .string()
          .trim()
          .min(1)
          .max(2000)
          .default("Describe this image clearly.")
          .describe("What the user wants to know about the image"),
      }),

      func: async ({ imageUrl, prompt }) => {
        const authToken = makeAuthToken(userId);

        return invokeMcpTool(analyzeImageMcpTool, {
          authToken,
          imageUrl,
          prompt,
        });
      },
    })
  );
}

  if (publishInstagramImageMcpTool) {
    securedTools.push(
      new DynamicStructuredTool({
        name: "publish_instagram_image",

        description: `
Publish an image to the authenticated user's connected Instagram account.

Requirements:
- imageUrl must be a public HTTPS URL, usually a Cloudinary secure_url.
- caption is optional. If omitted, the MCP tool generates a caption with AI.
- topic and imageDescription help generate a relevant caption.
- hashtags are optional.
- The application requires explicit user approval before publishing.
- Never claim the post was published unless the tool confirms success.
`,

        schema: z.object({
          imageUrl: z
            .string()
            .url()
            .refine((url) => url.startsWith("https://"), {
              message: "Image URL must use HTTPS",
            })
            .describe("Public HTTPS image URL from Cloudinary"),

          caption: z
            .string()
            .trim()
            .max(2200)
            .optional()
            .describe("Optional Instagram caption"),

          topic: z
            .string()
            .trim()
            .max(300)
            .optional()
            .describe("Optional topic for AI caption generation"),

          imageDescription: z
            .string()
            .trim()
            .max(1000)
            .optional()
            .describe("Optional description of the image"),

          hashtags: z
            .array(z.string().trim().min(1).max(100))
            .max(30)
            .optional()
            .describe("Optional hashtags"),
        }),

        func: async (args) => {
          const authToken = makeAuthToken(userId);

          return invokeMcpTool(publishInstagramImageMcpTool, {
            authToken,
            ...args,
          });
        },
      })
    );
  }

  // --------------------------------------------------
  // DEBUG: TOOLS PASSED TO LLM
  // --------------------------------------------------

  console.log(
    "Tools passed to LLM:",
    securedTools.map((tool) => tool.name)
  );

  // --------------------------------------------------
  // BIND TOOLS TO LLM
  // --------------------------------------------------

  const llmWithTools = llm.bindTools(securedTools);
  const toolNode = new ToolNode(securedTools);

  // --------------------------------------------------
  // CURRENT DATE AND TIME
  // --------------------------------------------------

  const currentDateTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date());

  // --------------------------------------------------
  // SYSTEM PROMPT
  // --------------------------------------------------

  const systemPrompt = `
${agent.instructions || "You are AutoMate AI, a helpful personal assistant."}

CURRENT DATE AND TIME:
- Current date and time in Asia/Kolkata: ${currentDateTime}
- Resolve today, tomorrow, and weekday references using this timestamp.
- Do not ask the user to confirm a date that can be resolved.

DEFAULT SETTINGS:
- Timezone: Asia/Kolkata.
- Default calendar event duration: 30 minutes.
- Infer meaningful event titles.
- Ask only for essential missing information.
- Never fabricate tool results.

IMPORTANT ACTION RULE:
- When the user directly requests an action, call the relevant tool.
- The application handles approval through an approval card.
- Do not ask for approval in your chat response.
- Never claim an action succeeded unless the tool confirms success.

EMAIL SENDING RULES:
1. Call send_email when the required details are available.
2. Ask for the recipient only when it is missing and cannot be inferred.
3. Never ask for passwords, tokens, API keys, or user IDs.
4. The application requests approval before sending.
5. Never claim an email was sent without tool confirmation.

CALENDAR RULES:
1. Call create_calendar_event when sufficient details are available.
2. Do not ask "Would you like me to create it?"
3. Resolve relative dates using the current date above.
4. Default duration is 30 minutes.
5. Use ISO 8601 date-time strings with an explicit timezone offset.
6. Set timeZone to "Asia/Kolkata".
7. Ask a follow-up only when an essential detail is missing.
8. Use list_calendar_events to retrieve existing events.
9. Never claim an event was created without tool confirmation.

GMAIL EMAIL READING RULES:
1. Use list_emails when the user asks to see or search emails.
2. Use "in:inbox" for the latest inbox emails.
3. Use "is:unread" for unread emails.
4. Use Gmail search syntax for sender and subject searches.
5. Use read_email to retrieve a specific email's content.
6. If its message ID is unknown, call list_emails first.
7. Summarize actual retrieved email content.
8. Never invent email content.
9. Reading and searching emails are read-only.
10. Use list_emails and read_email, not their raw MCP tool names.

INSTAGRAM PUBLISHING RULES:
1. If the latest user message asks to post, publish, share or upload an
   image to Instagram, call publish_instagram_image IMMEDIATELY.
   This applies even if the user also asks for a caption.
2. Take imageUrl from the "Image URL:" line of the latest user message.
3. If the user gave no caption, omit the caption argument. The app
   generates the caption and shows it on an approval card.
4. NEVER write a caption in chat and ask "should I publish?".
   NEVER ask for confirmation in chat. The app shows the approval card.
5. Do not call analyze_image first when the user clearly wants to
   publish. Pass topic and imageDescription only if the user gave them.
6. If the user only uploads an image, or only asks for a caption,
   description or analysis, do NOT publish.
7. If the user says "don't post" or "only caption", do not publish.
8. If publishing is requested but there is no "Image URL:" in the
   message, ask the user to upload the image first.
9. Never claim a post was published without tool confirmation.

IMAGE ANALYSIS RULES:
1. If the user uploads an image or asks a question about an image,
   use analyze_image when the image URL is available.
2. If the user uploads an image without a question, analyze it and
   provide a useful description.
3. Answer image-related questions using the actual analysis.
4. Never call publish_instagram_image for image analysis or description.
5. Never suggest publishing solely because an image was uploaded.
6. Keep image analysis and Instagram publishing as separate actions.
7. If image analysis fails, explain the failure honestly.
8. Never claim to have viewed an image if analysis failed.

GENERAL RULES:
- Be concise and helpful.
- Infer parameters when sufficient context is available.
- Never substitute a natural-language promise for a tool call.
- Ask questions only when essential information is missing.


`
  // --------------------------------------------------
  // CHAT NODE
  // --------------------------------------------------

 const isHumanMessage = (m) =>
  m?._getType?.() === "human" ||
  m?.constructor?.name === "HumanMessage" ||
  m?.role === "user";
 
const chatNode = async (state) => {
  const messages = state.messages || [];
 
  let lastHumanIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isHumanMessage(messages[i])) {
      lastHumanIndex = i;
      break;
    }
  }
 
  const lastHuman = lastHumanIndex >= 0 ? messages[lastHumanIndex] : null;
  const humanText =
    typeof lastHuman?.content === "string" ? lastHuman.content : "";
 
  const hasImageUrl = /Image URL:\s*https:\/\/\S+/i.test(humanText);
 
  const alreadyCalled = messages
    .slice(lastHumanIndex + 1)
    .some((m) =>
      m?.tool_calls?.some((c) => c.name === "publish_instagram_image")
    );
 
  const forcePublish =
    Boolean(publishInstagramImageMcpTool) &&
    hasImageUrl &&
    isExplicitInstagramPublishRequest(humanText) &&
    !alreadyCalled;
 
  const model = forcePublish
    ? llm.bindTools(securedTools, {
        tool_choice: "publish_instagram_image",
      })
    : llmWithTools;
 
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
 
  return { messages: [response] };
};

  // --------------------------------------------------
  // APPROVAL-PROTECTED ACTIONS
  // --------------------------------------------------

  const approvalToolNames = new Set([
    "send_email",
    "create_calendar_event",
    "publish_instagram_image",
  ]);

  // --------------------------------------------------
  // ROUTE AFTER CHAT
  // --------------------------------------------------

  // --------------------------------------------------
// ROUTE AFTER CHAT
// --------------------------------------------------

const routeAfterChat = (state) => {
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage?.tool_calls?.length) {
    return END;
  }

  // Find the latest user message.
  const latestUserMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        message._getType?.() === "human" ||
        message.constructor?.name === "HumanMessage" ||
        message.role === "user"
    );

  const userText =
    typeof latestUserMessage?.content === "string"
      ? latestUserMessage.content
      : "";

  // Prevent Instagram publishing unless the user explicitly
  // requested an Instagram publishing action.
  const instagramPublishCall = lastMessage.tool_calls.some(
    (call) => call.name === "publish_instagram_image"
  );

  if (
    instagramPublishCall &&
    !isExplicitInstagramPublishRequest(userText)
  ) {
    console.warn(
      "Blocked Instagram publishing: explicit user intent not found."
    );

    return "blockInstagramPublish";
  }

  const requiresApproval = lastMessage.tool_calls.some((call) =>
    approvalToolNames.has(call.name)
  );

  return requiresApproval ? "actionApproval" : "tools";
};


// --------------------------------------------------
// BLOCK UNREQUESTED INSTAGRAM PUBLISHING
// --------------------------------------------------

const blockInstagramPublishNode = async (state) => {
  const lastMessage = state.messages[state.messages.length - 1];

  const toolCalls = lastMessage?.tool_calls || [];

  return {
    messages: toolCalls.map(
      (call) =>
        new ToolMessage({
          tool_call_id: call.id,
          content: JSON.stringify({
            success: false,
            blocked: true,
            message:
              "Instagram publishing was blocked because the user did not explicitly request it.",
          }),
        })
    ),
  };
};
  // --------------------------------------------------
  // APPROVAL NODE
  // --------------------------------------------------

  const actionApprovalNode = async (state) => {
    const lastMessage = state.messages[state.messages.length - 1];

    const toolCalls = lastMessage?.tool_calls || [];

    // Only one approval-protected action at a time.
    if (
      toolCalls.length !== 1 ||
      !approvalToolNames.has(toolCalls[0].name)
    ) {
      return {
        messages: toolCalls.map(
          (call) =>
            new ToolMessage({
              tool_call_id: call.id,
              content: JSON.stringify({
                success: false,
                message:
                  "Please request one approval-protected action at a time.",
              }),
            })
        ),
      };
    }

    const actionCall = toolCalls[0];
    const args = actionCall.args || {};

    // ----------------------------------------------
    // EMAIL APPROVAL
    // ----------------------------------------------

    if (actionCall.name === "send_email") {
      const { to, subject, body } = args;

      if (
        typeof to !== "string" ||
        typeof subject !== "string" ||
        typeof body !== "string" ||
        !to.trim() ||
        !subject.trim() ||
        !body.trim()
      ) {
        return {
          messages: [
            new ToolMessage({
              tool_call_id: actionCall.id,
              content: JSON.stringify({
                success: false,
                message: "The email draft is incomplete.",
              }),
            }),
          ],
        };
      }

      const decision = interrupt({
        type: "email_approval",
        toolCallId: actionCall.id,
        email: {
          to,
          subject,
          body,
        },
        message: "Review the email and approve or reject sending it.",
      });

      if (decision?.approved !== true) {
        return {
          messages: [
            new ToolMessage({
              tool_call_id: actionCall.id,
              content: JSON.stringify({
                success: false,
                rejected: true,
                message: "Email rejected. No email was sent.",
              }),
            }),
          ],
        };
      }

      // Continue to ToolNode only after approval.
      return {};
    }

    // ----------------------------------------------
    // INSTAGRAM IMAGE APPROVAL
    // ----------------------------------------------

   // ----------------------------------------------
// INSTAGRAM IMAGE PUBLISH APPROVAL
// ----------------------------------------------

if (actionCall.name === "publish_instagram_image") {
  const {
    imageUrl,
    caption,
    topic,
    imageDescription,
    hashtags = [],
  } = args;

  // Validate image URL
  let parsedUrl;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    parsedUrl = null;
  }

  if (
    !parsedUrl ||
    parsedUrl.protocol !== "https:" ||
    !Array.isArray(hashtags)
  ) {
    return {
      messages: [
        new ToolMessage({
          tool_call_id: actionCall.id,
          content: JSON.stringify({
            success: false,
            message:
              "Invalid Instagram post details. Please provide a public HTTPS image URL.",
          }),
        }),
      ],
    };
  }

  // ----------------------------------------------
  // STEP 1: GENERATE CAPTION BEFORE APPROVAL
  // ----------------------------------------------

  let finalCaption =
    typeof caption === "string" ? caption.trim() : "";

  if (!finalCaption) {
    try {
      const captionResponse = await new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: modelName,
        temperature: 0,
        maxRetries: 2,
        timeout: 30000,
      }).invoke([
        new SystemMessage(`
You are an Instagram caption writer.

Rules:
- Write one natural, engaging Instagram caption.
- Use the provided topic and image description.
- Never pretend to see an image based only on its URL.
- Do not invent facts about the image.
- Return only the caption.
- Do not add explanations or quotation marks.
- Do not generate hashtags unless requested.
        `),
        {
          role: "user",
          content: `
Topic: ${topic || "Not provided"}

Image description: ${
            imageDescription || "Not provided"
          }

User hashtags: ${
            hashtags.length
              ? hashtags
                  .map(
                    (tag) =>
                      `#${String(tag).replace(/^#+/, "")}`
                  )
                  .join(" ")
              : "None"
          }

Generate an Instagram caption.
          `,
        },
      ]);

      finalCaption = String(
        captionResponse.content || ""
      ).trim();
    } catch (error) {
      console.error(
        "Instagram caption generation failed:",
        error
      );

      return {
        messages: [
          new ToolMessage({
            tool_call_id: actionCall.id,
            content: JSON.stringify({
              success: false,
              message:
                "Caption generation failed. Please try again.",
            }),
          }),
        ],
      };
    }
  }

  if (!finalCaption) {
    return {
      messages: [
        new ToolMessage({
          tool_call_id: actionCall.id,
          content: JSON.stringify({
            success: false,
            message:
              "Could not generate an Instagram caption.",
          }),
        }),
      ],
    };
  }

  // ----------------------------------------------
  // STEP 2: APPEND USER HASHTAGS
  // ----------------------------------------------

  if (hashtags.length > 0) {
    const hashtagText = hashtags
      .map(
        (tag) =>
          `#${String(tag).replace(/^#+/, "")}`
      )
      .join(" ");

    finalCaption =
      `${finalCaption}\n\n${hashtagText}`;
  }

  finalCaption = finalCaption.slice(0, 2200);

  // ----------------------------------------------
  // STEP 3: SHOW ONE APPROVAL CARD
  // ----------------------------------------------

  const decision = interrupt({
    type: "instagram_publish_approval",
    toolCallId: actionCall.id,

    imageUrl,
    caption: finalCaption,

    topic: topic || "",
    imageDescription: imageDescription || "",
    hashtags,

    post: {
      imageUrl,
      caption: finalCaption,
      topic: topic || "",
      imageDescription: imageDescription || "",
      hashtags,
    },

    message:
      "Review the Instagram image and caption, then approve or reject publishing.",
  });

  // ----------------------------------------------
  // STEP 4: REJECT = DO NOT PUBLISH
  // ----------------------------------------------

  if (decision?.approved !== true) {
    return {
      messages: [
        new ToolMessage({
          tool_call_id: actionCall.id,
          content: JSON.stringify({
            success: false,
            rejected: true,
            message:
              "Instagram post rejected. Nothing was published.",
          }),
        }),
      ],
    };
  }

  // ----------------------------------------------
  // STEP 5: USE THE APPROVED CAPTION
  // ----------------------------------------------

  const updatedToolCalls = toolCalls.map((call) =>
    call.id === actionCall.id
      ? {
          ...call,
          args: {
            ...call.args,
            caption: finalCaption,
          },
        }
      : call
  );

  const sourceMessage =
    state.messages[state.messages.length - 1];

  return {
    messages: [
      new AIMessage({
         id: sourceMessage.id, 
        content: sourceMessage.content ?? "",
        tool_calls: updatedToolCalls,
        additional_kwargs:
          sourceMessage.additional_kwargs,
        response_metadata:
          sourceMessage.response_metadata,
      }),
    ],
  };
}

    // ----------------------------------------------
    // CALENDAR EVENT APPROVAL
    // ----------------------------------------------

    const {
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone = "Asia/Kolkata",
    } = args;

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (
      typeof summary !== "string" ||
      !summary.trim() ||
      !startDateTime ||
      !endDateTime ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return {
        messages: [
          new ToolMessage({
            tool_call_id: actionCall.id,
            content: JSON.stringify({
              success: false,
              message:
                "Calendar event details are invalid. Please clarify the date or time.",
            }),
          }),
        ],
      };
    }

    const decision = interrupt({
      type: "calendar_approval",
      toolCallId: actionCall.id,

      event: {
        summary,
        description: description || "",
        startDateTime,
        endDateTime,
        timeZone,
      },

      message:
        "Review the calendar event and approve or reject its creation.",
    });

    if (decision?.approved !== true) {
      return {
        messages: [
          new ToolMessage({
            tool_call_id: actionCall.id,
            content: JSON.stringify({
              success: false,
              rejected: true,
              message:
                "Calendar event rejected. No event was created.",
            }),
          }),
        ],
      };
    }

    // Continue to ToolNode only after approval.
    return {};
  };

  // --------------------------------------------------
  // ROUTE AFTER APPROVAL
  // --------------------------------------------------

  const routeAfterApproval = (state) => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (lastMessage instanceof ToolMessage) {
      // Rejected or invalid action.
      return "chat";
    }

    // Approved action: execute the tool.
    return "tools";
  }

    // --------------------------------------------------
  // BUILD GRAPH
  // --------------------------------------------------

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("chat", chatNode)
    .addNode("actionApproval", actionApprovalNode)
    .addNode("tools", toolNode)
     .addNode("blockInstagramPublish", blockInstagramPublishNode)
    .addEdge(START, "chat")
    .addConditionalEdges("chat", routeAfterChat)
    .addConditionalEdges("actionApproval", routeAfterApproval)
    .addEdge("tools", "chat")
    .addEdge("blockInstagramPublish", "chat");

  const checkpointer = await getCheckpointer();

  const graph = workflow.compile({
    checkpointer,
  });

  return {
    graph,
    modelName,

    sendEmailEnabled: Boolean(sendEmailMcpTool),

    createCalendarEventEnabled: Boolean(createCalendarMcpTool),

    listCalendarEventsEnabled: Boolean(listCalendarMcpTool),

    listEmailsEnabled: Boolean(listEmailsMcpTool),

    readEmailEnabled: Boolean(readEmailMcpTool),

    publishInstagramImageEnabled: Boolean(
      publishInstagramImageMcpTool
    ),
  };
};

// --------------------------------------------------
// FORMAT RESULTS
// --------------------------------------------------

const formatResult = (result, modelName) => {
  const lastMessage = result.messages?.[result.messages.length - 1];

  return {
    reply: lastMessage
      ? typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content)
      : "",

    model: modelName,

    interrupted: Boolean(result.__interrupt__?.length),

    interrupts: (result.__interrupt__ || []).map((item) => ({
      id: item.id,
      value: item.value,
    })),
  };
};

// --------------------------------------------------
// RUN AGENT
// --------------------------------------------------

export const runAgentGraph = async ({
  agent,
  message,
  threadId,
  userId,
}) => {
  if (!threadId) {
    throw new Error("threadId is required.");
  }

  if (!userId) {
    throw new Error("Authenticated userId is required.");
  }

  if (typeof message !== "string" || !message.trim()) {
    throw new Error("message is required.");
  }

  const { graph, modelName } = await createAgentGraph(agent, userId);

  const result = await graph.invoke(
    {
      messages: [
        {
          role: "user",
          content: message.trim(),
        },
      ],
    },
    {
      configurable: {
        thread_id: threadId,
      },

      recursionLimit: 15,
    }
  );

  return formatResult(result, modelName);
};

// --------------------------------------------------
// RESUME AFTER APPROVAL / REJECTION
// --------------------------------------------------

export const resumeAgentGraph = async ({
  agent,
  threadId,
  userId,
  approved,
}) => {
  if (!threadId) {
    throw new Error("threadId is required.");
  }

  if (!userId) {
    throw new Error("Authenticated userId is required.");
  }

  if (typeof approved !== "boolean") {
    throw new Error("approved must be true or false.");
  }

  const { graph, modelName } = await createAgentGraph(agent, userId);

  const result = await graph.invoke(
    new Command({
      resume: {
        approved,
      },
    }),
    {
      configurable: {
        thread_id: threadId,
      },

      recursionLimit: 15,
    }
  );

  return formatResult(result, modelName);
};
