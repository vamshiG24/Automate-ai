import mongoose from "mongoose";
import TeamRun from "../models/teamRun.model.js";
import { planTeam, MAX_TEAM_STEPS } from "../services/teamPlanner.service.js";
import { executeTeamRun, resumeTeamRun } from "../services/teamRunner.service.js";
import { CAPABILITY_IDS } from "../services/capabilities.js";
import { deductCredits } from "../utils/deductCredits.js";
import {
  getCreditCost,
  hasEnoughCredits,
  insufficientCreditsResponse,
} from "../utils/credits.js";

// Internal ids (checkpoint threads) stay on the server
const toClient = (run) => ({
  id: run._id,
  instruction: run.instruction,
  title: run.title,
  reasoning: run.reasoning,
  status: run.status,
  trigger: run.trigger,
  automationId: run.automationId,
  creditsUsed: run.creditsUsed,
  error: run.error,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  finishedAt: run.finishedAt,
  steps: run.steps.map((step) => ({
    stepId: step.stepId,
    agentName: step.agentName,
    role: step.role,
    task: step.task,
    capabilities: step.capabilities,
    dependsOn: step.dependsOn,
    status: step.status,
    output: step.output,
    error: step.error,
    interrupts: step.interrupts,
    autoApprovals: step.autoApprovals,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
  })),
});

const findRun = (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return TeamRun.findOne({ _id: req.params.id, userId: req.user._id });
};

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Team run not found." });

// POST /api/team/plan  { instruction }
export const createPlan = async (req, res) => {
  try {
    const { instruction } = req.body;

    if (typeof instruction !== "string" || instruction.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Describe what the team should do (at least 5 characters).",
      });
    }

    if (instruction.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Instruction cannot exceed 2000 characters.",
      });
    }

    const cost = getCreditCost("chat");

    if (!hasEnoughCredits(req.user, cost)) {
      return insufficientCreditsResponse(res, cost);
    }

    const plan = await planTeam(instruction.trim());

    const run = await TeamRun.create({
      userId: req.user._id,
      instruction: instruction.trim(),
      title: plan.title,
      reasoning: plan.reasoning,
      steps: plan.steps,
      creditsUsed: cost,
    });

    const { remainingCredits } = await deductCredits({
      userId: req.user._id,
      credits: cost,
    });

    return res.status(201).json({
      success: true,
      run: toClient(run),
      remainingCredits,
    });
  } catch (error) {
    console.error("Team plan error:", error.message);

    return res.status(502).json({
      success: false,
      message: "The planner could not build a team. Try rephrasing the instruction.",
    });
  }
};

// GET /api/team/runs
export const getRuns = async (req, res) => {
  try {
    const runs = await TeamRun.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    return res.status(200).json({
      success: true,
      runs: runs.map((run) => ({
        id: run._id,
        title: run.title,
        status: run.status,
        trigger: run.trigger,
        stepCount: run.steps.length,
        createdAt: run.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get team runs error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load team runs.",
    });
  }
};

// GET /api/team/runs/:id
export const getRun = async (req, res) => {
  try {
    const run = await findRun(req);
    if (!run) return notFound(res);

    return res.status(200).json({ success: true, run: toClient(run) });
  } catch (error) {
    console.error("Get team run error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load team run.",
    });
  }
};

// PATCH /api/team/runs/:id  { steps: [{ stepId, agentName?, task?, capabilities? }] }
// The user can edit or remove steps before the team runs.
export const updatePlan = async (req, res) => {
  try {
    const run = await findRun(req);
    if (!run) return notFound(res);

    if (run.status !== "planned") {
      return res.status(409).json({
        success: false,
        message: "Only a plan that hasn't started can be edited.",
      });
    }

    const { steps } = req.body;

    if (!Array.isArray(steps) || !steps.length || steps.length > MAX_TEAM_STEPS) {
      return res.status(400).json({
        success: false,
        message: `A plan needs 1-${MAX_TEAM_STEPS} steps.`,
      });
    }

    const keptIds = new Set();
    const updated = [];

    for (const edit of steps) {
      const original = run.steps.find((step) => step.stepId === edit?.stepId);

      if (!original) {
        return res.status(400).json({ success: false, message: "Unknown step in plan." });
      }

      const task = edit.task ?? original.task;
      const agentName = edit.agentName ?? original.agentName;
      const capabilities = edit.capabilities ?? original.capabilities;

      if (typeof task !== "string" || !task.trim() || task.length > 1000) {
        return res.status(400).json({ success: false, message: "Each task must be 1-1000 characters." });
      }

      if (typeof agentName !== "string" || !agentName.trim() || agentName.length > 60) {
        return res.status(400).json({ success: false, message: "Agent names must be 1-60 characters." });
      }

      if (!Array.isArray(capabilities) || capabilities.some((id) => !CAPABILITY_IDS.includes(id))) {
        return res.status(400).json({ success: false, message: "Invalid capability." });
      }

      updated.push({
        ...original.toObject(),
        task: task.trim(),
        agentName: agentName.trim(),
        capabilities: [...new Set(capabilities)],
        // Removed or later steps can't be dependencies
        dependsOn: original.dependsOn.filter((dep) => keptIds.has(dep)),
      });

      keptIds.add(original.stepId);
    }

    run.steps = updated;
    await run.save();

    return res.status(200).json({ success: true, run: toClient(run) });
  } catch (error) {
    console.error("Update team plan error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update plan.",
    });
  }
};

// POST /api/team/runs/:id/execute
export const executeRun = async (req, res) => {
  try {
    const existing = await findRun(req);
    if (!existing) return notFound(res);

    const estimate = existing.steps.length * getCreditCost("agentChat");

    if (!hasEnoughCredits(req.user, estimate)) {
      return insufficientCreditsResponse(res, estimate);
    }

    // Atomic planned -> running so a double click can't start it twice
    const run = await TeamRun.findOneAndUpdate(
      { _id: existing._id, userId: req.user._id, status: "planned" },
      { $set: { status: "running" } },
      { returnDocument: "after" }
    );

    if (!run) {
      return res.status(409).json({
        success: false,
        message: "This team has already started.",
      });
    }

    // Runs in the background; the frontend polls GET /runs/:id
    executeTeamRun(run._id);

    return res.status(202).json({ success: true, run: toClient(run) });
  } catch (error) {
    console.error("Execute team run error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to start the team.",
    });
  }
};

// POST /api/team/runs/:id/approve  { approved }
export const approveStep = async (req, res) => {
  try {
    const { approved } = req.body;

    if (typeof approved !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "approved must be a boolean.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const run = await TeamRun.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: "waiting_approval" },
      { $set: { status: "running" } },
      { returnDocument: "after" }
    );

    if (!run) {
      return res.status(409).json({
        success: false,
        message: "Nothing is waiting for approval.",
      });
    }

    resumeTeamRun(run, approved).catch((error) =>
      console.error("Resume team run error:", error.message)
    );

    return res.status(202).json({ success: true, run: toClient(run) });
  } catch (error) {
    console.error("Approve team step error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to process approval.",
    });
  }
};

// DELETE /api/team/runs/:id
export const deleteRun = async (req, res) => {
  try {
    const run = await findRun(req);
    if (!run) return notFound(res);

    if (run.status === "running") {
      return res.status(409).json({
        success: false,
        message: "Wait for the team to finish before deleting it.",
      });
    }

    await run.deleteOne();

    return res.status(200).json({ success: true, message: "Team run deleted." });
  } catch (error) {
    console.error("Delete team run error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete team run.",
    });
  }
};

// GET /api/team/pending
// Team runs waiting for the user's approval (used for alerts and badges)
export const getPendingApprovals = async (req, res) => {
  try {
    const runs = await TeamRun.find({ userId: req.user._id, status: "waiting_approval" })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select("title trigger updatedAt");

    return res.status(200).json({
      success: true,
      count: runs.length,
      runs: runs.map((run) => ({
        id: run._id,
        title: run.title,
        trigger: run.trigger,
        updatedAt: run.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Pending approvals error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load pending approvals." });
  }
};
