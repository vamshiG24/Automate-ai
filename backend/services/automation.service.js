import Automation from "../models/automation.model.js";
import TeamRun from "../models/teamRun.model.js";
import User from "../models/user.model.js";
import { executeTeamRun } from "./teamRunner.service.js";
import { computeNextRun } from "./schedule.js";
import { getCreditCost } from "../utils/credits.js";

// --------------------------------------------------
// SCHEDULED AUTOMATIONS
// --------------------------------------------------
// Every minute the scheduler looks for automations that are due, claims
// each one atomically (so it can never run twice) and starts a team run
// from the saved, user-reviewed plan. Risky actions in the run still pause
// for the user's approval, exactly like a manual run.

const TICK_MS = 60 * 1000;
// If the server was offline at run time, don't fire hours-old jobs
const MISSED_AFTER_MS = 2 * 60 * 60 * 1000;

const BUSY_STATUSES = ["running", "waiting_approval"];

/**
 * Start one run of an automation now.
 * @returns {{ runId?: string, skipped?: string }}
 */
export const startAutomationRun = async (automation, trigger = "schedule") => {
  const note = async (message) => {
    await Automation.updateOne(
      { _id: automation._id },
      { $set: { lastNote: message, lastRunAt: new Date() } }
    );
    return { skipped: message };
  };

  // Don't pile up runs while yesterday's run still waits for approval
  if (automation.lastRunId) {
    const previous = await TeamRun.findById(automation.lastRunId).select("status").lean();
    if (previous && BUSY_STATUSES.includes(previous.status)) {
      return note("Skipped: the previous run is still running or waiting for your approval.");
    }
  }

  const cost = automation.steps.length * getCreditCost("agentChat");
  const user = await User.findById(automation.userId).select("credits").lean();

  if (Number(user?.credits ?? 0) < cost) {
    return note(`Skipped: not enough credits (needs ${cost}).`);
  }

  const run = await TeamRun.create({
    userId: automation.userId,
    instruction: automation.instruction,
    title: automation.name,
    reasoning: trigger === "schedule"
      ? "Started automatically by your scheduled automation, using the plan you saved."
      : "Started manually from your automation, using the plan you saved.",
    status: "running",
    trigger: "schedule",
    automationId: automation._id,
    steps: automation.steps.map((step) => ({
      stepId: step.stepId,
      agentName: step.agentName,
      role: step.role,
      task: step.task,
      capabilities: step.capabilities,
      dependsOn: step.dependsOn,
    })),
  });

  await Automation.updateOne(
    { _id: automation._id },
    {
      $set: { lastRunAt: new Date(), lastRunId: run._id, lastNote: "" },
      $inc: { runCount: 1 },
    }
  );

  // Runs in the background; the AI Team page shows it live
  executeTeamRun(run._id);

  return { runId: String(run._id) };
};

// One scheduler pass: run everything that is due
export const runDueAutomations = async (now = new Date()) => {
  const due = await Automation.find({
    enabled: true,
    nextRunAt: { $lte: now },
  }).limit(20);

  for (const automation of due) {
    // Atomic claim: only the pass that moves nextRunAt forward may run it
    const claimed = await Automation.findOneAndUpdate(
      { _id: automation._id, nextRunAt: automation.nextRunAt },
      { $set: { nextRunAt: computeNextRun(automation.schedule, now) } },
      { returnDocument: "after" }
    );

    if (!claimed) continue;

    try {
      if (now - automation.nextRunAt > MISSED_AFTER_MS) {
        await Automation.updateOne(
          { _id: automation._id },
          { $set: { lastNote: "Missed: the server was offline at the scheduled time." } }
        );
        continue;
      }

      const result = await startAutomationRun(claimed, "schedule");
      console.log(`Automation "${claimed.name}": ${result.runId ? `started run ${result.runId}` : result.skipped}`);
    } catch (error) {
      console.error(`Automation "${automation.name}" failed to start:`, error.message);
    }
  }
};

let schedulerTimer = null;
let ticking = false;

export const startScheduler = () => {
  if (schedulerTimer) return;

  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      await runDueAutomations();
    } catch (error) {
      console.error("Scheduler error:", error.message);
    } finally {
      ticking = false;
    }
  };

  schedulerTimer = setInterval(tick, TICK_MS);
  schedulerTimer.unref?.();
  tick();
  console.log("Automation scheduler started (checks every minute).");
};
