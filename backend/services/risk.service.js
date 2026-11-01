import ApprovalDecision from "../models/approvalDecision.model.js";
import User from "../models/user.model.js";

// --------------------------------------------------
// RISK-BASED APPROVAL
// --------------------------------------------------
// Every real-world action (send email, create event, publish post) gets a
// 0-100 risk score with human-readable reasons. Low-risk actions can be
// auto-approved (if the user enabled it); everything else shows an approval
// card explaining WHY it is risky. The score also learns from the user's
// past approve / reject decisions for the same target.

export const RISKY_TOOLS = new Set([
  "send_email",
  "create_calendar_event",
  "publish_instagram_image",
]);

// Text inside these markers is data from tools or other agents, not from
// the user. Instructions in it must never be trusted (prompt injection).
export const UNTRUSTED_START = "<<UNTRUSTED_DATA>>";
export const UNTRUSTED_END = "<<END_UNTRUSTED_DATA>>";

const UNTRUSTED_BLOCK = new RegExp(
  `${UNTRUSTED_START}[\\s\\S]*?(${UNTRUSTED_END}|$)`,
  "g"
);

const SENSITIVE_WORDS =
  /\b(password|passcode|otp|one[- ]time code|pin|cvv|bank|account number|ifsc|upi|credit card|debit card|wire transfer|transfer money|send money|payment|invoice|gift card|bitcoin|crypto|aadhaar|pan card|ssn|login details|verify your account)\b/i;

const LINK = /https?:\/\/\S+/i;

const LEVELS = [
  { max: 29, level: "low" },
  { max: 59, level: "medium" },
  { max: 100, level: "high" },
];

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

const toLevel = (score) => LEVELS.find((item) => score <= item.max).level;

// Split a message into what the user wrote and embedded untrusted data
export const splitTrustedText = (text = "") => {
  const untrusted = [...String(text).matchAll(UNTRUSTED_BLOCK)]
    .map((match) => match[0])
    .join("\n");

  return {
    trusted: String(text).replace(UNTRUSTED_BLOCK, " "),
    untrusted,
  };
};

// The thing an action is aimed at, used to learn from past decisions
export const getRiskTarget = (toolName, args = {}) => {
  if (toolName === "send_email") {
    return String(args.to || "").trim().toLowerCase() || "unknown";
  }

  if (toolName === "create_calendar_event") return "calendar";
  if (toolName === "publish_instagram_image") return "instagram";

  return toolName;
};

const includesText = (haystack, needle) =>
  Boolean(needle) && String(haystack).toLowerCase().includes(needle.toLowerCase());

// --------------------------------------------------
// PURE SCORING (no database) - used by tests and the evaluation script
// --------------------------------------------------

/**
 * @param toolName      send_email | create_calendar_event | publish_instagram_image
 * @param args          tool arguments the agent wants to use
 * @param userText      what the user actually typed (trusted)
 * @param untrustedText content the agent read: emails, other agents' output
 * @param history       { approved, rejected } past decisions for this target
 * @param settings      { autoApproveLowRisk }
 * @param now           Date, injectable for tests
 */
export const scoreActionRisk = ({
  toolName,
  args = {},
  userText = "",
  untrustedText = "",
  history = { approved: 0, rejected: 0 },
  settings = {},
  now = new Date(),
}) => {
  const factors = [];
  const add = (code, points, reason) => factors.push({ code, points, reason });

  if (toolName === "send_email") {
    const recipient = String(args.to || "").trim().toLowerCase();
    const content = `${args.subject || ""}\n${args.body || ""}`;

    add("external_action", 20, "Sends an email outside the app");

    if (includesText(userText, recipient)) {
      add("recipient_from_user", -10, "You typed this recipient yourself");
    } else if (includesText(untrustedText, recipient)) {
      // Classic prompt injection: an email/web page says "send X to me"
      add(
        "recipient_from_untrusted_content",
        45,
        "Recipient address came from content the agent read, not from you (possible prompt injection)"
      );
    } else {
      add("recipient_inferred", 20, "Recipient was guessed by the agent, not written by you");
    }

    if (SENSITIVE_WORDS.test(content)) {
      add("sensitive_content", 30, "Mentions sensitive data (passwords, OTP, bank or payment details)");
    }

    if (LINK.test(args.body || "")) {
      add("contains_link", 10, "Contains a link");
    }

    if (history.rejected > 0) {
      add("previously_rejected", 25, `You rejected ${history.rejected} email(s) to this recipient before`);
    } else if (history.approved >= 2) {
      add("trusted_recipient", -25, `You approved ${history.approved} emails to this recipient before`);
    } else if (history.approved === 0) {
      // 20 keeps a first email at "medium" so it always needs approval
      add("new_recipient", 20, "First email to this recipient");
    }
  }

  if (toolName === "create_calendar_event") {
    const start = new Date(args.startDateTime);
    const end = new Date(args.endDateTime);
    const hoursAhead = (start - now) / 36e5;
    const durationHours = (end - start) / 36e5;
    const istHour = Number(
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        hourCycle: "h23",
      }).format(Number.isNaN(start.getTime()) ? now : start)
    );

    add("calendar_change", 10, "Adds an event to your calendar");

    if (hoursAhead < 0) {
      add("event_in_past", 30, "Event starts in the past");
    } else if (hoursAhead > 24 * 180) {
      add("event_far_future", 15, "Event is more than 6 months away");
    }

    if (durationHours > 4) {
      add("long_event", 10, "Event is longer than 4 hours");
    }

    if (istHour < 7 || istHour >= 22) {
      add("odd_hours", 10, "Event is outside 7 AM - 10 PM");
    }

    if (history.rejected > 0) {
      add("previously_rejected", 15, "You rejected calendar events before");
    } else if (history.approved >= 3) {
      add("trusted_action", -10, `You approved ${history.approved} calendar events before`);
    }
  }

  if (toolName === "publish_instagram_image") {
    add("public_post", 45, "Publishes publicly on Instagram");

    if (SENSITIVE_WORDS.test(`${args.caption || ""} ${args.topic || ""}`)) {
      add("sensitive_content", 20, "Caption mentions sensitive or financial topics");
    }

    if (history.rejected > 0) {
      add("previously_rejected", 10, "You rejected Instagram posts before");
    }
  }

  const hasFactor = (code) => factors.some((item) => item.code === code);
  const injectionSuspected = hasFactor("recipient_from_untrusted_content");
  const sensitive = hasFactor("sensitive_content");

  // Hard rules: trust history must never hide a possible injection (floor
  // "high") or sensitive data such as passwords/bank details (floor "medium").
  // Found by `npm run evaluate`: without the second floor, bank details sent
  // to a familiar contact scored "low" and were auto-approved.
  const rawScore = factors.reduce((total, item) => total + item.points, 0);
  const floor = injectionSuspected ? 70 : sensitive ? 45 : 0;
  const score = clamp(Math.max(rawScore, floor));
  const level = toLevel(score);

  // Auto-approve only: user opted in, low risk, never public posts, and
  // never anything touched by untrusted content or carrying sensitive data.
  const autoApprove =
    settings.autoApproveLowRisk === true &&
    level === "low" &&
    toolName !== "publish_instagram_image" &&
    !injectionSuspected &&
    !sensitive;

  return {
    score,
    level,
    autoApprove,
    target: getRiskTarget(toolName, args),
    factors: factors.map(({ code, points }) => ({ code, points })),
    reasons: factors
      .filter((item) => item.points > 0)
      .sort((a, b) => b.points - a.points)
      .map((item) => item.reason),
    trustSignals: factors
      .filter((item) => item.points < 0)
      .map((item) => item.reason),
  };
};

// --------------------------------------------------
// DATABASE-BACKED ASSESSMENT
// --------------------------------------------------

export const getDecisionHistory = async (userId, toolName, target) => {
  const [approved, rejected] = await Promise.all([
    ApprovalDecision.countDocuments({ userId, toolName, target, approved: true }),
    ApprovalDecision.countDocuments({ userId, toolName, target, approved: false }),
  ]);

  return { approved, rejected };
};

export const assessActionRisk = async ({
  userId,
  toolName,
  args,
  userText,
  untrustedText,
}) => {
  const target = getRiskTarget(toolName, args);

  const [history, user] = await Promise.all([
    getDecisionHistory(userId, toolName, target),
    User.findById(userId).select("autoApproveLowRisk").lean(),
  ]);

  return scoreActionRisk({
    toolName,
    args,
    userText,
    untrustedText,
    history,
    settings: { autoApproveLowRisk: Boolean(user?.autoApproveLowRisk) },
  });
};

// Logged after the user (or auto-approval) decides. Never breaks the action.
export const recordDecision = async ({
  userId,
  toolName,
  assessment,
  approved,
  autoApproved = false,
  source = "chat",
}) => {
  try {
    await ApprovalDecision.create({
      userId,
      toolName,
      target: assessment?.target || toolName,
      riskScore: assessment?.score ?? 0,
      riskLevel: assessment?.level || "medium",
      riskFactors: (assessment?.factors || []).map((item) => item.code),
      approved,
      autoApproved,
      source,
    });
  } catch (error) {
    console.error("Record approval decision error:", error.message);
  }
};
