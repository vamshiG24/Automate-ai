import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowLeft, Brain, CalendarDays, ChevronDown, ChevronUp, CircleCheck, CircleDashed,
  CircleX, Coins, CornerDownRight, Hourglass, ImagePlus, LoaderCircle, Lock, Mail,
  Play, Plus, ScanEye, Send, ShieldAlert, ShieldCheck, Sparkles, Trash2, Users,
} from "lucide-react";

import {
  planTeamApi, fetchTeamRunsApi, fetchTeamRunApi, updateTeamPlanApi,
  executeTeamRunApi, approveTeamStepApi, deleteTeamRunApi, fetchApprovalStatsApi,
} from "@/features/team";
import { fetchMeApi } from "@/features/auth";
import { setUser } from "@/redux/userSlice";
import ApprovalCard from "@/components/ApprovalCard";
import { buildApproval, describeAutoApprovals, getInterrupt } from "@/lib/approvals";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const darkPanel =
  "border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";
const whiteBtn =
  "rounded-xl border-0 bg-white text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900";
const hideScrollbar =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

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
  pending: { label: "Waiting", Icon: CircleDashed, ring: "border-white/15 text-zinc-500", text: "text-zinc-500" },
  running: { label: "Working", Icon: LoaderCircle, ring: "border-violet-400/50 text-violet-300", text: "text-violet-300", spin: true },
  waiting_approval: { label: "Needs approval", Icon: Hourglass, ring: "border-amber-400/50 text-amber-300", text: "text-amber-300" },
  completed: { label: "Done", Icon: CircleCheck, ring: "border-emerald-400/50 text-emerald-300", text: "text-emerald-300" },
  failed: { label: "Failed", Icon: CircleX, ring: "border-red-400/50 text-red-300", text: "text-red-300" },
  skipped: { label: "Skipped", Icon: CircleDashed, ring: "border-white/10 text-zinc-600", text: "text-zinc-500" },
};

const RUN_STATUS = {
  planned: { label: "Plan ready", pill: "bg-white/10 text-zinc-200" },
  running: { label: "Running", pill: "bg-violet-400/15 text-violet-200" },
  waiting_approval: { label: "Needs your approval", pill: "bg-amber-400/15 text-amber-200" },
  completed: { label: "Completed", pill: "bg-emerald-400/15 text-emerald-200" },
  failed: { label: "Finished with errors", pill: "bg-red-400/15 text-red-200" },
};

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function CapabilityChips({ capabilities }) {
  if (!capabilities.length) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400">
        <Brain size={12} />No tools · thinks and writes only
      </span>
    );
  }

  return capabilities.map((id) => {
    const meta = CAPABILITY_META[id] ?? { label: id, Icon: Lock };
    return (
      <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-2.5 py-1 text-[11px] text-violet-200">
        <meta.Icon size={12} />{meta.label}
      </span>
    );
  });
}

function StepOutput({ text }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Result</p>
      <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-zinc-200">
        {long && !open ? `${text.slice(0, 420)}…` : text}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1.5 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
          {open ? <><ChevronUp size={13} />Show less</> : <><ChevronDown size={13} />Show full result</>}
        </button>
      )}
    </div>
  );
}

function StepCard({ step, index, isLast, steps, editable, canRemove, onTaskChange, onRemove, approvalLoading, onDecision }) {
  const status = STEP_STATUS[step.status] ?? STEP_STATUS.pending;
  const approval = step.status === "waiting_approval"
    ? buildApproval(getInterrupt({ interrupts: step.interrupts }), {})?.approval
    : null;
  const autoNotes = describeAutoApprovals(step.autoApprovals);
  const dependencyNames = step.dependsOn
    .map((id) => steps.find((item) => item.stepId === id)?.agentName)
    .filter(Boolean);

  return (
    <li className="relative flex gap-3 sm:gap-4">
      {/* timeline rail */}
      <div className="flex flex-col items-center">
        <span className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 bg-[#16181d] ${status.ring}`}>
          <status.Icon size={16} className={status.spin ? "animate-spin" : ""} />
        </span>
        {!isLast && <span className="w-px flex-1 bg-white/10" />}
      </div>

      <div className={`mb-4 min-w-0 flex-1 rounded-2xl p-4 ${darkPanel} ${step.status === "running" ? "border-violet-400/30" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Agent {index + 1}</p>
            <h3 className="text-[15px] font-semibold text-white">{step.agentName}</h3>
            {step.role && <p className="mt-0.5 text-xs text-zinc-400">{step.role}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
            {editable && canRemove && (
              <button type="button" onClick={onRemove} aria-label={`Remove ${step.agentName}`} title="Remove this agent" className="grid size-7 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500" title="This agent gets only these permissions">
            <Lock size={11} />Permissions:
          </span>
          <CapabilityChips capabilities={step.capabilities} />
        </div>

        {dependencyNames.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <CornerDownRight size={12} />Uses results from {dependencyNames.join(", ")} (as untrusted data)
          </p>
        )}

        <div className="mt-3">
          {editable ? (
            <Textarea
              value={step.task}
              maxLength={1000}
              onChange={(event) => onTaskChange(event.target.value)}
              aria-label={`Task for ${step.agentName}`}
              className={`min-h-20 resize-y rounded-xl border-white/10 bg-black/20 text-[13px] leading-6 text-zinc-200 focus-visible:border-white/25 focus-visible:ring-0 ${hideScrollbar}`}
            />
          ) : (
            <p className="text-[13px] leading-6 text-zinc-300">{step.task}</p>
          )}
        </div>

        {(autoNotes.length > 0 || step.output || step.error || approval) && (
          <div className="mt-3 space-y-2.5">
            {autoNotes.map((note) => (
              <p key={note} className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs leading-5 text-emerald-200">{note}</p>
            ))}
            {approval && <ApprovalCard approval={approval} loading={approvalLoading} onDecision={onDecision} className="!bg-black/20" />}
            {step.output && <StepOutput text={step.output} />}
            {step.error && <p className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">{step.error}</p>}
          </div>
        )}
      </div>
    </li>
  );
}

function SafetyStats({ stats }) {
  if (!stats) return null;
  const items = [
    { label: "Actions checked", value: stats.total, Icon: ShieldCheck, tone: "text-zinc-200" },
    { label: "Auto-approved", value: stats.autoApproved, Icon: CircleCheck, tone: "text-emerald-300" },
    { label: "Rejected by you", value: stats.rejected, Icon: CircleX, tone: "text-red-300" },
    { label: "Injection attempts flagged", value: stats.injectionFlags, Icon: ShieldAlert, tone: "text-amber-300" },
  ];

  return (
    <section aria-label="Safety statistics" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <item.Icon size={15} className={item.tone} />
          <p className="mt-2 text-xl font-semibold tabular-nums text-white">{item.value}</p>
          <p className="text-[11px] leading-4 text-zinc-500">{item.label}</p>
        </div>
      ))}
    </section>
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

  const steps = run?.status === "planned" ? draftSteps : run?.steps ?? [];
  const runStatus = RUN_STATUS[run?.status];
  const finished = run && ["completed", "failed"].includes(run.status);
  const finalOutput = finished ? [...run.steps].reverse().find((step) => step.output)?.output : "";

  return (
    <div className="relative min-h-dvh bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#2b2f3a_0%,#191b21_55%,#121317_100%)] text-white">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#16181d]/80 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label="Back to chat" className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 hover:bg-white/10 hover:text-white"><ArrowLeft size={16} /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-violet-300" />Agent Teams</h1>
            <p className="hidden text-[11px] text-zinc-500 sm:block">One instruction → a team of least-privilege agents</p>
          </div>
        </div>
        <Link to="/pricing" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10">
          <Coins size={14} className="text-violet-300" />{Number(user?.credits ?? 0).toLocaleString("en-IN")} credits
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 sm:px-6">
        {/* History */}
        <aside className="hidden w-60 shrink-0 lg:block" aria-label="Team history">
          <div className="sticky top-22 space-y-1">
            <button type="button" onClick={() => setSearchParams({})} className="mb-2 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/10">
              <Plus size={15} />New team task
            </button>
            <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Recent teams</p>
            {!runs.length && <p className="px-3 text-xs text-zinc-500">No team runs yet.</p>}
            {runs.map((item) => {
              const itemStatus = STEP_STATUS[item.status === "planned" ? "pending" : item.status] ?? STEP_STATUS.pending;
              return (
                <div key={item.id} className={`group flex items-center rounded-xl ${item.id === run?.id ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"}`}>
                  <button type="button" onClick={() => setSearchParams({ run: item.id })} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left">
                    <itemStatus.Icon size={14} className={`shrink-0 ${itemStatus.text}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-zinc-200">{item.title}</span>
                      <span className="block text-[11px] text-zinc-500">{item.stepCount} agent{item.stepCount === 1 ? "" : "s"}</span>
                    </span>
                  </button>
                  {item.status !== "running" && (
                    <button type="button" onClick={() => handleDelete(item)} aria-label={`Delete ${item.title}`} className="mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-zinc-500 opacity-0 hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300">{error}</div>}

          {!runId && (
            <>
              <section className="pt-4 text-center">
                <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-white text-zinc-900"><Users size={26} /></div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What should your AI team do?</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                  The Planner splits your instruction into specialist agents. Each agent gets <span className="text-zinc-200">only the permissions its step needs</span>, and every real action is risk-scored before it runs.
                </p>
              </section>

              <form onSubmit={handlePlan} className={`mx-auto w-full max-w-2xl rounded-2xl p-3 focus-within:border-white/25 ${darkPanel}`}>
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
                  className={`min-h-24 resize-none border-0 !bg-transparent px-2 py-1.5 text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0 ${hideScrollbar}`}
                />
                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="px-2 text-[11px] text-zinc-500">Planning costs 10 credits · each agent 10</span>
                  <Button type="submit" disabled={planning || instruction.trim().length < 5} className={`h-9 gap-2 px-4 ${whiteBtn} disabled:bg-white/10 disabled:text-zinc-500`}>
                    {planning ? <><LoaderCircle size={15} className="animate-spin" />Planning…</> : <><Sparkles size={15} />Build team</>}
                  </Button>
                </div>
              </form>

              <div className="mx-auto flex max-w-2xl flex-col gap-2">
                <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Try an example</p>
                {EXAMPLES.map((example) => (
                  <button key={example} type="button" onClick={() => setInstruction(example)} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-left text-[13px] leading-5 text-zinc-300 hover:border-white/15 hover:bg-white/[0.06]">
                    {example}
                  </button>
                ))}
              </div>

              <div className="mx-auto max-w-2xl">
                <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Your safety record</p>
                <SafetyStats stats={stats} />
              </div>

              {runs.length > 0 && (
                <div className="mx-auto max-w-2xl lg:hidden">
                  <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Recent teams</p>
                  <div className="space-y-1.5">
                    {runs.slice(0, 5).map((item) => (
                      <button key={item.id} type="button" onClick={() => setSearchParams({ run: item.id })} className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-left text-[13px] text-zinc-200">
                        <span className="truncate">{item.title}</span>
                        <span className="ml-3 shrink-0 text-[11px] text-zinc-500">{RUN_STATUS[item.status]?.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {runId && !run && !error && (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-400"><LoaderCircle size={16} className="animate-spin" />Loading team…</div>
          )}

          {run && (
            <>
              <section className={`rounded-2xl p-5 ${darkPanel}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight">{run.title}</h2>
                  {runStatus && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${runStatus.pill}`}>{runStatus.label}</span>}
                </div>
                <blockquote className="mt-3 border-l-2 border-white/15 pl-3 text-[13px] leading-6 text-zinc-300">{run.instruction}</blockquote>
                {run.reasoning && (
                  <p className="mt-3 flex gap-2 text-xs leading-5 text-zinc-400"><Brain size={14} className="mt-0.5 shrink-0 text-violet-300" /><span><span className="text-zinc-300">Planner:</span> {run.reasoning}</span></p>
                )}
                {run.status === "planned" && (
                  <p className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs leading-5 text-zinc-400">
                    Review the plan. You can edit any agent's task or remove agents before running.
                  </p>
                )}
              </section>

              <ol aria-label="Team agents">
                {steps.map((step, index) => (
                  <StepCard
                    key={step.stepId}
                    step={step}
                    index={index}
                    isLast={index === steps.length - 1}
                    steps={steps}
                    editable={run.status === "planned"}
                    canRemove={steps.length > 1}
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="mr-auto text-xs text-zinc-500">Estimated cost: {draftSteps.length * STEP_COST} credits</span>
                  <Button type="button" variant="ghost" onClick={() => handleDelete(run)} className="rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white">Discard</Button>
                  <Button type="button" onClick={handleExecute} disabled={busy || !draftSteps.length} className={`h-9 gap-2 px-4 ${whiteBtn}`}>
                    {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} />}Run team
                  </Button>
                </div>
              )}

              {run.status === "running" && (
                <p className="flex items-center justify-center gap-2 text-sm text-zinc-400" aria-live="polite">
                  <LoaderCircle size={15} className="animate-spin text-violet-300" />Agents are working… this page updates live.
                </p>
              )}

              {finished && (
                <section className={`rounded-2xl p-5 ${darkPanel}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{run.status === "completed" ? "Final result" : "Result"}</p>
                  {finalOutput && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-200">{finalOutput}</p>}
                  {run.error && <p className="mt-2 text-sm text-red-300">{run.error}</p>}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500">Credits used: {run.creditsUsed}</span>
                    <Button type="button" onClick={() => setSearchParams({})} className={`h-9 gap-2 px-4 ${whiteBtn}`}><Plus size={15} />New team task</Button>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
