import { ChatGroq } from "@langchain/groq";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import * as z from "zod/v4";

import { CAPABILITIES, CAPABILITY_IDS } from "./capabilities.js";

// --------------------------------------------------
// INSTRUCTION -> TEAM PLANNER
// --------------------------------------------------
// Turns one user instruction into a small team of specialist agents.
// Each agent gets ONLY the capabilities its own step needs (least
// privilege), and steps form a dependency graph (DAG) so an agent can
// use the output of earlier agents.

export const MAX_TEAM_STEPS = 5;

const planSchema = z.object({
  title: z.string().describe("Short title for this task, max 8 words"),
  reasoning: z
    .string()
    .describe("One or two sentences on how the work was split and why"),
  steps: z
    .array(
      z.object({
        id: z.string().describe("Step id: s1, s2, s3 ..."),
        agentName: z.string().describe("Short agent name, e.g. 'Inbox Reader'"),
        role: z.string().describe("One sentence describing the agent's expertise"),
        task: z
          .string()
          .describe("Exact, self-contained task for this agent, including any names, emails, dates the user gave"),
        capabilities: z
          .array(z.enum(CAPABILITY_IDS))
          .describe("Minimum capabilities this step needs. Empty for pure thinking/writing steps"),
        dependsOn: z
          .array(z.string())
          .describe("Ids of earlier steps whose output this step needs"),
      })
    )
    .min(1)
    .max(MAX_TEAM_STEPS),
});

const capabilityList = Object.entries(CAPABILITIES)
  .map(([id, item]) => `- ${id}: ${item.description}`)
  .join("\n");

const plannerPrompt = () => `
You are the Planner of AutoMate AI. You split a user's instruction into a
small team of specialist AI agents that run one after another.

Available capabilities:
${capabilityList}

Rules:
1. Use 1-${MAX_TEAM_STEPS} steps. Use 1 step if the task is simple. Never add steps that are not needed.
2. LEAST PRIVILEGE: give each agent only the capabilities its own task needs.
   Never give one agent both reading (gmail.read) and acting (gmail.send,
   post.instagram) unless the task is impossible otherwise. Prefer a reader
   agent followed by a separate writer/sender agent.
3. Steps that only think, summarise or write text get NO capabilities.
4. Each task must be self-contained: copy every email address, name, date,
   time and image URL the user gave into the task that needs it.
5. dependsOn lists earlier steps whose output the step needs. Only refer to
   earlier step ids. The first step has no dependencies.
6. Never invent email addresses. Only use addresses the user wrote, or tell
   the agent to use the address found by an earlier step.
7. Current date and time (Asia/Kolkata): ${new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "full",
  timeStyle: "short",
}).format(new Date())}
`;

// Clean up whatever the LLM returned so the runner can trust the plan
export const sanitizePlan = (plan) => {
  const steps = [];
  const seen = new Set();

  for (const [index, step] of (plan.steps || []).slice(0, MAX_TEAM_STEPS).entries()) {
    const stepId = `s${index + 1}`;
    const originalId = String(step.id || stepId);

    // Map the LLM's ids to clean ones while keeping dependencies valid
    const dependsOn = (step.dependsOn || [])
      .map((dep) => String(dep))
      .map((dep) => steps.find((item) => item.originalId === dep)?.stepId)
      .filter((dep) => dep && seen.has(dep));

    steps.push({
      originalId,
      stepId,
      agentName: String(step.agentName || `Agent ${index + 1}`).slice(0, 60),
      role: String(step.role || "").slice(0, 300),
      task: String(step.task || "").slice(0, 1000),
      capabilities: [...new Set((step.capabilities || []).filter((id) => CAPABILITY_IDS.includes(id)))],
      dependsOn: [...new Set(dependsOn)],
    });

    seen.add(stepId);
  }

  return {
    title: String(plan.title || "Team run").slice(0, 120),
    reasoning: String(plan.reasoning || "").slice(0, 1000),
    steps: steps
      .filter((step) => step.task.trim())
      .map(({ originalId, ...step }) => step),
  };
};

export const planTeam = async (instruction) => {
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    temperature: 0.2,
    maxRetries: 4,
    timeout: 45000,
  });

  const planner = llm.withStructuredOutput(planSchema, { name: "team_plan" });

  const plan = await planner.invoke([
    new SystemMessage(plannerPrompt()),
    new HumanMessage(instruction),
  ]);

  const cleaned = sanitizePlan(plan);

  if (!cleaned.steps.length) {
    throw new Error("The planner returned an empty plan.");
  }

  return cleaned;
};
