import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Brain, CalendarDays, ChevronDown, ChevronUp, CircleCheck, CircleDashed,
  CircleX, CornerDownRight, Hourglass, ImagePlus, LoaderCircle, Lock, Mail,
  Play, Plus, ScanEye, Send, ShieldAlert, ShieldCheck, Sparkles, Trash2, Users,
} from "lucide-react";

import {
  planTeamApi, fetchTeamRunsApi, fetchTeamRunApi, updateTeamPlanApi,
  executeTeamRunApi, approveTeamStepApi, deleteTeamRunApi, fetchApprovalStatsApi,
} from "@/features/team";
import { fetchMeApi } from "@/features/auth";
import { setUser } from "@/redux/userSlice";
import AppShell from "@/components/AppShell";
import ApprovalCard from "@/components/ApprovalCard";
import LiveOffice from "@/components/office/LiveOffice";
import { describeStep } from "@/components/office/status";
import { seatColor } from "@/components/office/layout";
import { buildApproval, describeAutoApprovals, getInterrupt } from "@/lib/approvals";
import { Textarea } from "@/components/ui/textarea";

const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none";
const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
const label = "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400";

const STEP_COST = 10;
const POLL_MS = 2000;

const EXAMPLES = [
  "Check if my HOD mailed about the project review, add the deadline to my calendar and email a summary to rahul@example.com",
  "Read my 5 latest unread emails, write a short to-do list from them and schedule a 30 min focus block tomorrow at 10 AM",
  "Write a 4 line poem about the monsoon in Bangalore, then translate it into Hindi",
];

const CAPABILITY_META = {
  "gmail.read": { label: "Read emails", Icon: Mail },
  "gmail.send": { label: "Send emails", Icon: Send },
  "event.schedule": { label: "Calendar", Icon: CalendarDays },
  "image.analyze": { label: "Analyze image", Icon: ScanEye },
  "post.instagram": { label: "Instagram", Icon: ImagePlus },
};

const STEP_STATUS = {
  pending: { label: "Waiting", Icon: CircleDashed, pill: "bg-slate-100 text-slate-600" },
  running: { label: "Working", Icon: LoaderCircle, pill: "bg-violet-50 text-violet-700", spin: true },
  waiting_approval: { label: "Needs approval", Icon: Hourglass, pill: "bg-amber-50 text-amber-700" },
  completed: { label: "Done", Icon: CircleCheck, pill: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", Icon: CircleX, pill: "bg-red-50 text-red-700" },
  skipped: { label: "Skipped", Icon: CircleDashed, pill: "bg-slate-100 text-slate-500" },
};

const RUN_STATUS = {
  planned: { label: "Plan ready", pill: "bg-slate-100 text-slate-700" },
  running: { label: "Running", pill: "bg-violet-50 text-violet-700" },
  waiting_approval: { label: "Needs your approval", pill: "bg-amber-50 text-amber-700" },
  completed: { label: "Completed", pill: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Finished with errors", pill: "bg-red-50 text-red-700" },
};

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function CapabilityChips({ capabilities }) {
  if (!capabilities.length) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
        <Brain size={12} />No tools · thinks and writes only
      </span>
    );
  }

  return capabilities.map((id) => {
    const meta = CAPABILITY_META[id] ?? { label: id, Icon: Lock };
    return (
      <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-600/10">
        <meta.Icon size={12} />{meta.label}
      </span>
    );
  });
}

function StepOutput({ text }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
      <p className={label}>Result</p>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-700">
        {long && !open ? `${text.slice(0, 420)}…` : text}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          {open ? <><ChevronUp size={13} />Show less</> : <><ChevronDown size={13} />Show full result</>}
        </button>
      )}
    </div>
  );
}

function StepCard({ step, index, steps, runStatus, editable, canRemove, highlighted, onTaskChange, onRemove, approvalLoading, onDecision }) {
  const status = STEP_STATUS[step.status] ?? STEP_STATUS.pending;
  const approval = step.status === "waiting_approval"
    ? buildApproval(getInterrupt({ interrupts: step.interrupts }), {})?.approval
    : null;
  const autoNotes = describeAutoApprovals(step.autoApprovals);
  const dependencyNames = step.dependsOn
    .map((id) => steps.find((item) => item.stepId === id)?.agentName)
    .filter(Boolean);

  return (
    <li id={`step-${step.stepId}`} className={`${card} scroll-mt-24 p-5 transition ${highlighted ? "ring-2 ring-indigo-500" : ""} ${step.status === "running" ? "border-violet-200" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        {/* colour matches the agent's hoodie in the office */}
        <span className="grid size-11 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: seatColor(index) }}>
          {step.agentName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className={label}>Agent {index + 1}</p>
          <h3 className="text-[15px] font-semibold text-slate-900">{step.agentName}</h3>
          {step.role && <p className="mt-0.5 text-[13px] text-slate-500">{step.role}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.pill}`}>
            <status.Icon size={13} className={status.spin ? "animate-spin" : ""} />{status.label}
          </span>
          {editable && canRemove && (
            <button type="button" onClick={onRemove} aria-label={`Remove ${step.agentName}`} title="Remove this agent" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500" title="This agent gets only these permissions">
          <Lock size={11} />Permissions
        </span>
        <CapabilityChips capabilities={step.capabilities} />
      </div>

      {dependencyNames.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-500">
          <CornerDownRight size={13} />Uses results from <span className="font-medium text-slate-700">{dependencyNames.join(", ")}</span> as untrusted data
        </p>
      )}

      <div className="mt-3">
        {editable ? (
          <Textarea
            value={step.task}
            maxLength={1000}
            onChange={(event) => onTaskChange(event.target.value)}
            aria-label={`Task for ${step.agentName}`}
            className="min-h-20 resize-y rounded-xl border-slate-200 bg-white text-[13px] leading-6 text-slate-800 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/15"
          />
        ) : (
          <p className="text-[13px] leading-6 text-slate-600">{step.task}</p>
        )}
      </div>

      {!editable && (
        <p className="mt-2 text-xs text-slate-400">{describeStep(step, steps, runStatus)}</p>
      )}

      {(autoNotes.length > 0 || step.output || step.error || approval) && (
        <div className="mt-4 space-y-3">
          {autoNotes.map((note) => (
            <p key={note} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">{note}</p>
          ))}
          {approval && <ApprovalCard approval={approval} loading={approvalLoading} onDecision={onDecision} className="!shadow-none" />}
          {step.output && <StepOutput text={step.output} />}
          {step.error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{step.error}</p>}
        </div>
      )}
    </li>
  );
}

function SafetyStats({ stats }) {
  const items = [
    { label: "Actions checked", value: stats?.total ?? 0, Icon: ShieldCheck, tile: "bg-indigo-50 text-indigo-600" },
    { label: "Auto-approved", value: stats?.autoApproved ?? 0, Icon: CircleCheck, tile: "bg-emerald-50 text-emerald-600" },
    { label: "Rejected by you", value: stats?.rejected ?? 0, Icon: CircleX, tile: "bg-red-50 text-red-600" },
    { label: "Injections flagged", value: stats?.injectionFlags ?? 0, Icon: ShieldAlert, tile: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <span className={`grid size-8 place-items-center rounded-lg ${item.tile}`}><item.Icon size={15} /></span>
          <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{item.value}</p>
          <p className="text-[11px] leading-4 text-slate-500">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function Team() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get("run");

  const [instruction, setInstruction] = useState("");
  const [planning, setPlanning] = useState(false);
  const [loadedRun, setLoadedRun] = useState(null);
  const [draftSteps, setDraftSteps] = useState([]);
  const [runs, setRuns] = useState([]);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [highlighted, setHighlighted] = useState(null);
  const lastStatus = useRef(null);

  const refreshUser = useCallback(async () => {
    try {
      dispatch(setUser(await fetchMeApi()));
    } catch {
      // Credits will refresh on the next page load
    }
  }, [dispatch]);

  const loadSidebar = useCallback(async () => {
    try {
      const [list, safety] = await Promise.all([fetchTeamRunsApi(), fetchApprovalStatsApi()]);
      setRuns(list);
      setStats(safety);
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load team history."));
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([fetchTeamRunsApi(), fetchApprovalStatsApi()])
      .then(([list, safety]) => {
        if (!active) return;
        setRuns(list);
        setStats(safety);
      })
      .catch((loadError) => active && setError(errorMessage(loadError, "Failed to load team history.")));
    return () => { active = false; };
  }, []);

  const showRun = useCallback((next) => {
    setLoadedRun(next);
    setDraftSteps(next?.steps ?? []);
  }, []);

  // The run on screen always follows the URL (?run=id)
  const run = runId && loadedRun?.id === runId ? loadedRun : null;

  useEffect(() => {
    if (!runId || loadedRun?.id === runId) return;

    let active = true;
    fetchTeamRunApi(runId)
      .then((next) => active && showRun(next))
      .catch((loadError) => active && setError(errorMessage(loadError, "Failed to load team run.")));
    return () => { active = false; };
  }, [runId, loadedRun?.id, showRun]);

  // Poll while agents are working
  useEffect(() => {
    if (run?.status !== "running") return;
    const timer = setTimeout(async () => {
      try {
        showRun(await fetchTeamRunApi(run.id));
      } catch (pollError) {
        setError(errorMessage(pollError, "Lost connection to the team run."));
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [run, showRun]);

  // When a run stops working, refresh credits, history and safety stats
  useEffect(() => {
    const status = run?.status;
    if (lastStatus.current === "running" && status && status !== "running") {
      refreshUser();
      loadSidebar();
    }
    lastStatus.current = status;
  }, [run?.status, refreshUser, loadSidebar]);

  const handlePlan = async (event) => {
    event.preventDefault();
    if (!instruction.trim() || planning) return;
    setPlanning(true);
    setError("");
    try {
      const data = await planTeamApi(instruction.trim());
      if (typeof data.remainingCredits === "number" && user) {
        dispatch(setUser({ ...user, credits: data.remainingCredits }));
      }
      showRun(data.run);
      setSearchParams({ run: data.run.id });
      setInstruction("");
      loadSidebar();
    } catch (planError) {
      setError(errorMessage(planError, "The planner could not build a team."));
    } finally {
      setPlanning(false);
    }
  };

  const planChanged =
    run?.status === "planned" &&
    (draftSteps.length !== run.steps.length ||
      draftSteps.some((step, index) => step.task !== run.steps[index]?.task));

  const handleExecute = async () => {
    if (!run || busy) return;
    if (draftSteps.some((step) => !step.task.trim())) {
      setError("Every agent needs a task.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (planChanged) {
        await updateTeamPlanApi(run.id, draftSteps.map(({ stepId, task }) => ({ stepId, task })));
      }
      showRun(await executeTeamRunApi(run.id));
    } catch (runError) {
      setError(errorMessage(runError, "Failed to start the team."));
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (approved) => {
    if (!run || busy) return;
    setBusy(true);
    setError("");
    try {
      showRun(await approveTeamStepApi(run.id, approved));
    } catch (approveError) {
      setError(errorMessage(approveError, "Failed to send your decision."));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (target) => {
    if (!window.confirm(`Delete "${target.title}"?`)) return;
    try {
      await deleteTeamRunApi(target.id);
      setRuns((previous) => previous.filter((item) => item.id !== target.id));
      if (target.id === run?.id) setSearchParams({});
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Failed to delete team run."));
    }
  };

  // Clicking an agent in the office jumps to its card
  const focusStep = (stepId) => {
    setHighlighted(stepId);
    document.getElementById(`step-${stepId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const steps = run?.status === "planned" ? draftSteps : run?.steps ?? [];
  const runStatus = RUN_STATUS[run?.status];
  const finished = run && ["completed", "failed"].includes(run.status);
  const finalOutput = finished ? [...run.steps].reverse().find((step) => step.output)?.output : "";

  return (
    <AppShell
      title="AI Team"
      subtitle="Live agent office · one instruction, a team of least-privilege agents"
      actions={runId && (
        <button type="button" onClick={() => setSearchParams({})} className={`${secondaryBtn} hidden px-3 py-2 sm:inline-flex`}>
          <Plus size={15} />New task
        </button>
      )}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Live office */}
          <section className={`${card} overflow-hidden p-1.5`} aria-label="Live agent office">
            <div className="overflow-hidden rounded-[14px]">
              <LiveOffice
                steps={run ? steps : []}
                runStatus={run?.status}
                onSelect={focusStep}
                selectedId={highlighted}
              />
            </div>
          </section>

          {!runId && (
            <>
              <form onSubmit={handlePlan} className={`${card} p-5`}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500"><Users size={19} /></span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">What should your AI team do?</h2>
                    <p className="text-sm text-slate-500">The Planner hires specialist agents and gives each one only the permissions its step needs.</p>
                  </div>
                </div>
                <Textarea
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  maxLength={2000}
                  disabled={planning}
                  placeholder="e.g. Read my latest emails from HOD, add any deadlines to my calendar, and email a summary to my teammate…"
                  aria-label="Instruction for the team"
                  className="min-h-28 resize-none rounded-xl border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/15"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">Planning costs 10 credits · each agent 10</span>
                  <button type="submit" disabled={planning || instruction.trim().length < 5} className={primaryBtn}>
                    {planning ? <><LoaderCircle size={15} className="animate-spin" />Hiring your team…</> : <><Sparkles size={15} />Build team</>}
                  </button>
                </div>
              </form>

              <div>
                <p className={`${label} mb-2 px-1`}>Try an example</p>
                <div className="grid gap-2.5 md:grid-cols-3">
                  {EXAMPLES.map((example) => (
                    <button key={example} type="button" onClick={() => setInstruction(example)} className={`${card} p-4 text-left text-[13px] leading-5 text-slate-600 transition hover:border-indigo-200 hover:shadow-md`}>
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {runId && !run && !error && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading team…</div>
          )}

          {run && (
            <>
              <section className={`${card} p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">{run.title}</h2>
                  {runStatus && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${runStatus.pill}`}>{runStatus.label}</span>}
                </div>
                <blockquote className="mt-3 border-l-2 border-indigo-200 pl-3 text-[13px] leading-6 text-slate-600">{run.instruction}</blockquote>
                {run.reasoning && (
                  <p className="mt-3 flex gap-2 text-[13px] leading-5 text-slate-500"><Brain size={15} className="mt-0.5 shrink-0 text-violet-500" /><span><span className="font-medium text-slate-700">Planner:</span> {run.reasoning}</span></p>
                )}
                {run.status === "planned" && (
                  <p className="mt-3 rounded-xl bg-indigo-50/60 px-3 py-2 text-xs leading-5 text-indigo-800">
                    Review the plan. You can edit any agent's task or remove agents before running.
                  </p>
                )}
              </section>

              <ol className="space-y-4" aria-label="Team agents">
                {steps.map((step, index) => (
                  <StepCard
                    key={step.stepId}
                    step={step}
                    index={index}
                    steps={steps}
                    runStatus={run.status}
                    editable={run.status === "planned"}
                    canRemove={steps.length > 1}
                    highlighted={highlighted === step.stepId}
                    onTaskChange={(task) => setDraftSteps((previous) => previous.map((item) => item.stepId === step.stepId ? { ...item, task } : item))}
                    onRemove={() => setDraftSteps((previous) => previous
                      .filter((item) => item.stepId !== step.stepId)
                      .map((item) => ({ ...item, dependsOn: item.dependsOn.filter((dep) => dep !== step.stepId) })))}
                    approvalLoading={busy}
                    onDecision={handleDecision}
                  />
                ))}
              </ol>

              {run.status === "planned" && (
                <div className={`${card} flex flex-wrap items-center justify-end gap-2 p-4`}>
                  <span className="mr-auto text-sm text-slate-500">Estimated cost: <span className="font-medium text-slate-800">{draftSteps.length * STEP_COST} credits</span></span>
                  <button type="button" onClick={() => handleDelete(run)} className={secondaryBtn}>Discard</button>
                  <button type="button" onClick={handleExecute} disabled={busy || !draftSteps.length} className={primaryBtn}>
                    {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} />}Run team
                  </button>
                </div>
              )}

              {run.status === "running" && (
                <p className="flex items-center justify-center gap-2 text-sm text-slate-500" aria-live="polite">
                  <LoaderCircle size={15} className="animate-spin text-violet-500" />Agents are working… the office updates live.
                </p>
              )}

              {finished && (
                <section className={`${card} p-5`}>
                  <p className={label}>{run.status === "completed" ? "Final result" : "Result"}</p>
                  {finalOutput && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{finalOutput}</p>}
                  {run.error && <p className="mt-2 text-sm text-red-600">{run.error}</p>}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Credits used: {run.creditsUsed}</span>
                    <button type="button" onClick={() => setSearchParams({})} className={primaryBtn}><Plus size={15} />New team task</button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Right column: history + safety */}
        <aside className="space-y-6">
          <section className={`${card} p-4`} aria-label="Recent teams">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent teams</h2>
              {runId && (
                <button type="button" onClick={() => setSearchParams({})} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"><Plus size={13} />New</button>
              )}
            </div>
            {!runs.length && <p className="py-3 text-xs text-slate-500">No team runs yet. Your teams will show up here.</p>}
            <ul className="space-y-0.5">
              {runs.map((item) => {
                const itemStatus = STEP_STATUS[item.status === "planned" ? "pending" : item.status] ?? STEP_STATUS.pending;
                return (
                  <li key={item.id} className={`group flex items-center rounded-xl ${item.id === run?.id ? "bg-indigo-50/70" : "hover:bg-slate-50"}`}>
                    <button type="button" onClick={() => setSearchParams({ run: item.id })} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left">
                      <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${itemStatus.pill}`}><itemStatus.Icon size={14} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-slate-800">{item.title}</span>
                        <span className="block text-[11px] text-slate-500">{item.stepCount} agent{item.stepCount === 1 ? "" : "s"} · {RUN_STATUS[item.status]?.label}</span>
                      </span>
                    </button>
                    {item.status !== "running" && (
                      <button type="button" onClick={() => handleDelete(item)} aria-label={`Delete ${item.title}`} className="mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={`${card} p-4`} aria-label="Safety record">
            <h2 className="text-sm font-semibold text-slate-900">Your safety record</h2>
            <p className="mb-3 text-xs text-slate-500">Every real action is risk-scored before it runs.</p>
            <SafetyStats stats={stats} />
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
