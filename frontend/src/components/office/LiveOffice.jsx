import OfficeScene from "./OfficeScene";
import { SEAT_COUNT, seatAnchor } from "./layout";
import { describeStep } from "./status";

const DOT = {
  running: "bg-violet-500",
  waiting_approval: "bg-amber-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  skipped: "bg-slate-300",
  pending: "bg-sky-500",
};

function headline(runStatus, steps) {
  const working = steps.filter((step) => step.status === "running").length;

  switch (runStatus) {
    case "running":
      return { live: true, text: `Live · ${working} of ${steps.length} working` };
    case "waiting_approval":
      return { live: true, text: "Live · waiting for your approval" };
    case "planned":
      return { live: false, text: `Plan ready · ${steps.length} agent${steps.length === 1 ? "" : "s"}` };
    case "completed":
      return { live: false, text: "All done" };
    case "failed":
      return { live: false, text: "Finished with errors" };
    default:
      return { live: false, text: "Your AI office · ready for a task" };
  }
}

const IDLE_TEAM = Array.from({ length: 4 }, (_, index) => ({ id: `idle-${index}`, status: "idle" }));

/**
 * The office with live status bubbles. Without `steps` it shows an idle team.
 * Optional: `headline` ({ live, text }) and `describe(step)` override the
 * default texts; `compact` uses small bubbles for small containers;
 * `minimal` shows only the animated office (no headline or bubbles).
 */
export default function LiveOffice({ steps = [], runStatus, onSelect, selectedId, headline: headlineOverride, describe, compact = false, minimal = false }) {
  const seated = steps.slice(0, SEAT_COUNT);
  const agents = seated.length
    ? seated.map((step) => ({ id: step.stepId, status: step.status, title: step.agentName }))
    : IDLE_TEAM;
  const title = headlineOverride ?? headline(seated.length ? runStatus : null, seated);

  return (
    <div className="relative">
      <OfficeScene agents={agents} className="block aspect-[3/2] w-full" />

      {!minimal && (<>

      <div className={`absolute inline-flex items-center gap-2 rounded-full bg-white/95 font-medium text-slate-800 shadow-md shadow-slate-900/10 ${compact ? "left-2 top-2 px-2.5 py-1 text-[11px]" : "left-3 top-3 px-3 py-1.5 text-xs sm:left-4 sm:top-4 sm:text-sm"}`}>
        <span className={`size-2 rounded-full ${title.live ? "animate-pulse bg-red-500" : runStatus === "completed" ? "bg-emerald-500" : "bg-slate-400"}`} />
        {title.text}
      </div>

      {seated.map((step, index) => {
        const anchor = seatAnchor(index);
        const label = describe ? describe(step) : describeStep(step, seated, runStatus);
        const active = selectedId === step.stepId;

        return (
          <button
            key={step.stepId}
            type="button"
            onClick={() => onSelect?.(step.stepId)}
            title={`${step.agentName}: ${label}`}
            style={{ left: `${anchor.left}%`, top: `${anchor.top}%` }}
            className={`absolute flex max-w-[46%] -translate-x-1/2 -translate-y-full items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 font-medium text-slate-800 shadow-md shadow-slate-900/10 transition hover:scale-105 hover:bg-white focus-visible:outline-2 focus-visible:outline-indigo-500 ${compact ? "px-2 py-0.5 text-[10px]" : "px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-[13px]"} ${active ? "ring-2 ring-indigo-500" : ""} ${step.status === "running" || step.status === "waiting_approval" ? "office-bob" : ""}`}
          >
            <span className={`size-2 shrink-0 rounded-full ${DOT[step.status] ?? "bg-slate-400"}`} />
            <span className={`truncate text-slate-500 ${compact ? "" : "hidden md:inline"}`}>{step.agentName}{compact ? ":" : " ·"}</span>
            <span className="truncate">{label}</span>
            {step.status === "running" && (
              <span className="flex gap-0.5" aria-hidden>
                <span className="office-dot size-1 rounded-full bg-violet-400" />
                <span className="office-dot size-1 rounded-full bg-violet-400" />
                <span className="office-dot size-1 rounded-full bg-violet-400" />
              </span>
            )}
          </button>
        );
      })}
      </>)}
    </div>
  );
}
