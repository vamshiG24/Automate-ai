import { continueAgentGraph } from "./agentGraph.service.js";

// Groq's free tier allows ~8000 tokens per minute. LangChain only retries a
// 429 when the provider's wait hint is short, so longer waits are handled
// here: wait as long as the provider asks, then continue the SAME graph from
// its last checkpoint (no duplicate user message, no repeated approved action).

const MAX_RATE_LIMIT_RETRIES = 4;

export const isRateLimit = (error) =>
  error?.status === 429 || /rate limit/i.test(error?.message || "");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Groq says e.g. "Please try again in 13.88s" or "in 750ms"
const retryDelayMs = (error) => {
  const match = /try again in ([\d.]+)\s*(ms|s)/i.exec(error?.message || "");
  const hinted = match ? Number(match[1]) * (match[2] === "ms" ? 1 : 1000) : 20000;
  return Math.min(Math.max(hinted + 1000, 3000), 65000);
};

export const withRateLimitRetry = async (firstCall, { agent, threadId, userId, label }) => {
  const since = Date.now();

  try {
    return await firstCall();
  } catch (error) {
    let lastError = error;

    for (let attempt = 1; attempt <= MAX_RATE_LIMIT_RETRIES && isRateLimit(lastError); attempt++) {
      const delay = retryDelayMs(lastError);
      console.warn(`${label}: rate limited, retrying in ${Math.round(delay / 1000)}s`);
      await sleep(delay);

      try {
        return await continueAgentGraph({ agent, threadId, userId, since });
      } catch (retryError) {
        lastError = retryError;
      }
    }

    throw lastError;
  }
};
