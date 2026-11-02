// Must be the first import so every module sees the .env values
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { connectDB } from "./config/db.js";
import authRouter from "./routes/auth.routes.js";
import agentRouter from "./routes/agent.routes.js";
import agentChatRouter from "./routes/agentChat.routes.js";
import chatRouter from "./routes/chat.routes.js";
import conversationRouter from "./routes/conversation.routes.js";
import integrationRouter from "./routes/integration.route.js";
import paymentRouter from "./routes/payment.routes.js";
import teamRouter from "./routes/team.routes.js";
import approvalRouter from "./routes/approval.routes.js";
import automationRouter from "./routes/automation.routes.js";
import { failInterruptedRuns } from "./services/teamRunner.service.js";
import { startScheduler } from "./services/automation.service.js";

// Fail fast on missing or weak secrets instead of failing at runtime
const REQUIRED_ENV = [
  "MONGODB_URI",
  "JWT_SECRET",
  "GROQ_API_KEY",
  "ENCRYPTION_KEY",
  "AUTOMATE_MCP_SECRET",
];

const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);

if (missingEnv.length) {
  console.error(`Missing required env variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters long.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Needed for correct client IPs (rate limiting) behind Render/Railway proxies
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials:true
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// General limit for every API route (the Team page polls for progress)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

// Stricter limit for routes that call paid AI APIs or log in
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "You're sending messages too fast. Please wait a minute." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth",authRouter)
app.use("/api/agents", agentRouter);
app.use("/api/agent-chat", aiLimiter, agentChatRouter);
app.use("/api/chat", aiLimiter, chatRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/team/plan", aiLimiter);
app.use("/api/team", teamRouter);
app.use("/api/approvals", approvalRouter);
app.use("/api/automations", automationRouter);
app.use("/api/integrations", integrationRouter);
app.use("/api/payment", paymentRouter);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Last-resort error handler (e.g. invalid JSON body) - never leaks stack traces
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || error.statusCode || 500;

  if (status >= 500) {
    console.error("Unhandled error:", error);
  }

  res.status(status).json({
    success: false,
    message: status >= 500 ? "Something went wrong." : error.message,
  });
});

app.listen(PORT, () => {
  console.log(`AutoMate AI API running at ${PORT}`);

  connectDB()
    .then(failInterruptedRuns)
    .then(startScheduler)
    .catch((error) => {
      console.error("MongoDB connection failed:", error.message);
    });
});
