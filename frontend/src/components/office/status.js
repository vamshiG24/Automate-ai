// What the status bubble above an agent says

const ACTIVITY = {
  "gmail.read": "Reading emails",
  "gmail.send": "Drafting email",
  "event.schedule": "Planning calendar",
  "image.analyze": "Looking at image",
  "post.instagram": "Preparing post",
};

export function describeStep(step, steps, runStatus) {
  if (step.status === "running") {
    const activity = step.capabilities.map((id) => ACTIVITY[id]).find(Boolean);
    return activity || (step.dependsOn.length ? "Writing" : "Thinking");
  }
  if (step.status === "waiting_approval") return "Needs your approval";
  if (step.status === "completed") return "Task done";
  if (step.status === "failed") return "Stuck · see details";
  if (step.status === "skipped") return "Skipped";
  if (runStatus === "planned") return "Ready";

  const waitingFor = step.dependsOn
    .map((id) => steps.find((item) => item.stepId === id))
    .find((item) => item && item.status !== "completed");
  return waitingFor ? `Waiting for ${waitingFor.agentName}` : "Up next";
}

