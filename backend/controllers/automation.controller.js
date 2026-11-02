import mongoose from "mongoose";
import Automation from "../models/automation.model.js";
import TeamRun from "../models/teamRun.model.js";
import { startAutomationRun } from "../services/automation.service.js";
import { computeNextRun, validateSchedule } from "../services/schedule.js";

const MAX_AUTOMATIONS = 10;

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Automation not found." });

const cleanSchedule = ({ frequency, time, dayOfWeek }) => ({
  frequency,
  time,
  dayOfWeek: frequency === "weekly" ? dayOfWeek : 1,
});

const toClient = (automation, lastRun) => ({
  id: automation._id,
  name: automation.name,
  instruction: automation.instruction,
  steps: automation.steps.map(({ stepId, agentName, role, task, capabilities, dependsOn }) => ({
    stepId, agentName, role, task, capabilities, dependsOn,
  })),
  schedule: automation.schedule,
  enabled: automation.enabled,
  nextRunAt: automation.enabled ? automation.nextRunAt : null,
  lastRunAt: automation.lastRunAt,
  lastNote: automation.lastNote,
  runCount: automation.runCount,
  lastRun: lastRun ? { id: lastRun._id, status: lastRun.status } : null,
  createdAt: automation.createdAt,
});

const findOwned = (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return Automation.findOne({ _id: req.params.id, userId: req.user._id });
};

// GET /api/automations
export const getAutomations = async (req, res) => {
  try {
    const automations = await Automation.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const runIds = automations.map((item) => item.lastRunId).filter(Boolean);
    const runs = await TeamRun.find({ _id: { $in: runIds } }).select("status").lean();
    const runById = new Map(runs.map((run) => [String(run._id), run]));

    return res.status(200).json({
      success: true,
      automations: automations.map((item) => toClient(item, runById.get(String(item.lastRunId)))),
    });
  } catch (error) {
    console.error("Get automations error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load automations." });
  }
};

// POST /api/automations  { runId, name, schedule }
// Saves the (already reviewed) plan of a team run as a scheduled automation
export const createAutomation = async (req, res) => {
  try {
    const { runId, name, schedule } = req.body;

    if (!mongoose.isValidObjectId(runId)) {
      return res.status(400).json({ success: false, message: "A valid team run is required." });
    }

    if (typeof name !== "string" || !name.trim() || name.length > 80) {
      return res.status(400).json({ success: false, message: "Name must be 1-80 characters." });
    }

    const scheduleError = validateSchedule(schedule);
    if (scheduleError) {
      return res.status(400).json({ success: false, message: scheduleError });
    }

    const count = await Automation.countDocuments({ userId: req.user._id });
    if (count >= MAX_AUTOMATIONS) {
      return res.status(400).json({ success: false, message: `You can have up to ${MAX_AUTOMATIONS} automations.` });
    }

    const run = await TeamRun.findOne({ _id: runId, userId: req.user._id });
    if (!run) {
      return res.status(404).json({ success: false, message: "Team run not found." });
    }

    const cleaned = cleanSchedule(schedule);
    const automation = await Automation.create({
      userId: req.user._id,
      name: name.trim(),
      instruction: run.instruction,
      steps: run.steps.map(({ stepId, agentName, role, task, capabilities, dependsOn }) => ({
        stepId, agentName, role, task, capabilities, dependsOn,
      })),
      schedule: cleaned,
      nextRunAt: computeNextRun(cleaned),
    });

    return res.status(201).json({ success: true, automation: toClient(automation, null) });
  } catch (error) {
    console.error("Create automation error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save automation." });
  }
};

// PATCH /api/automations/:id  { name?, enabled?, schedule? }
export const updateAutomation = async (req, res) => {
  try {
    const automation = await findOwned(req);
    if (!automation) return notFound(res);

    const { name, enabled, schedule } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.length > 80) {
        return res.status(400).json({ success: false, message: "Name must be 1-80 characters." });
      }
      automation.name = name.trim();
    }

    if (schedule !== undefined) {
      const scheduleError = validateSchedule(schedule);
      if (scheduleError) {
        return res.status(400).json({ success: false, message: scheduleError });
      }
      automation.schedule = cleanSchedule(schedule);
    }

    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ success: false, message: "enabled must be a boolean." });
      }
      automation.enabled = enabled;
    }

    // Re-plan the next run whenever the schedule or on/off state changes
    if (schedule !== undefined || enabled === true) {
      automation.nextRunAt = computeNextRun(automation.schedule);
    }

    await automation.save();

    const lastRun = automation.lastRunId
      ? await TeamRun.findById(automation.lastRunId).select("status").lean()
      : null;

    return res.status(200).json({ success: true, automation: toClient(automation, lastRun) });
  } catch (error) {
    console.error("Update automation error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update automation." });
  }
};

// POST /api/automations/:id/run  - run it now, outside the schedule
export const runAutomationNow = async (req, res) => {
  try {
    const automation = await findOwned(req);
    if (!automation) return notFound(res);

    const result = await startAutomationRun(automation, "manual");

    if (result.skipped) {
      return res.status(409).json({ success: false, message: result.skipped });
    }

    return res.status(202).json({ success: true, runId: result.runId });
  } catch (error) {
    console.error("Run automation error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to start automation." });
  }
};

// DELETE /api/automations/:id  (past runs stay in team history)
export const deleteAutomation = async (req, res) => {
  try {
    const automation = await findOwned(req);
    if (!automation) return notFound(res);

    await automation.deleteOne();
    return res.status(200).json({ success: true, message: "Automation deleted." });
  } catch (error) {
    console.error("Delete automation error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete automation." });
  }
};
