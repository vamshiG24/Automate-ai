// Credit cost of each AI action. CHAT_CREDIT_COST in .env overrides
// the normal chat price; agent actions cost more because they call tools.
// Read lazily so the value is taken after dotenv has loaded.
export const getCreditCost = (action) =>
  ({
    chat: Number.parseInt(process.env.CHAT_CREDIT_COST, 10) || 5,
    agentChat: 10,
    approval: 15,
  })[action];

// Checked BEFORE calling the LLM so users with no credits
// cannot spend API quota or trigger tools (emails, posts).
export const hasEnoughCredits = (user, cost) =>
  Number(user?.credits ?? 0) >= cost;

export const insufficientCreditsResponse = (res, cost) =>
  res.status(402).json({
    success: false,
    code: "INSUFFICIENT_CREDITS",
    message: `You need at least ${cost} credits for this action. Please buy more credits.`,
  });
