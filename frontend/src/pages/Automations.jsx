import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, CalendarClock, CircleAlert, Clock, LoaderCircle, Pencil, Play,
  ShieldCheck, Trash2, Users,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import ScheduleFields from "@/components/ScheduleFields";
import {
  deleteAutomationApi, fetchAutomationsApi, runAutomationNowApi, updateAutomationApi,
} from "@/features/automations";
import { describeSchedule } from "@/lib/alerts";

const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const secondaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";
const STEP_COST = 10;

const RUN_STATUS = {
  running: { label: "Running", pill: "bg-violet-50 text-violet-700" },
  waiting_approval: { label: "Needs your approval", pill: "bg-amber-50 text-amber-700" },
  completed: { label: "Completed", pill: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Finished with errors", pill: "bg-red-50 text-red-700" },
};

const formatWhen = (date) =>
  new Date(date).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  });

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

function AutomationCard({ automation, onChange, onDelete }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [schedule, setSchedule] = useState(automation.schedule);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const lastRun = automation.lastRun && RUN_STATUS[automation.lastRun.status];

  const act = async (kind, work) => {
    setBusy(kind);
    setError("");
    try {
      await work();
    } catch (actionError) {
      setError(errorMessage(actionError, "Something went wrong."));
    } finally {
      setBusy("");
    }
  };

  const toggle = () => act("toggle", async () => onChange(await updateAutomationApi(automation.id, { enabled: !automation.enabled })));
  const saveSchedule = () => act("save", async () => {
    onChange(await updateAutomationApi(automation.id, { schedule }));
    setEditing(false);
  });
  const runNow = () => act("run", async () => {
    const runId = await runAutomationNowApi(automation.id);
    navigate(`/team?run=${runId}`);
  });
  const remove = () => {
    if (!window.confirm(`Delete the automation "${automation.name}"? Past runs stay in your team history.`)) return;
    act("delete", async () => {
      await deleteAutomationApi(automation.id);
      onDelete(automation.id);
    });
  };

  return (
    <article className={`${card} p-5 ${automation.enabled ? "" : "opacity-75"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${automation.enabled ? "bg-teal-50 text-teal-600" : "bg-slate-100 text-slate-400"}`}>
          <CalendarClock size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-slate-900">{automation.name}</h3>
          <p className="text-[13px] text-slate-500">{describeSchedule(automation.schedule)} · about {automation.steps.length * STEP_COST} credits per run</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={automation.enabled}
          aria-label={automation.enabled ? "Pause automation" : "Turn automation on"}
          disabled={busy === "toggle"}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${automation.enabled ? "bg-teal-500" : "bg-slate-200"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${automation.enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <blockquote className="mt-4 border-l-2 border-teal-200 pl-3 text-[13px] leading-6 text-slate-600">{automation.instruction}</blockquote>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {automation.steps.map((step) => (
          <span key={step.stepId} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <Users size={11} />{step.agentName}
          </span>
        ))}
      </div>

      <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50/80 p-3 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Next run</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 text-slate-800"><Clock size={13} className="text-slate-400" />{automation.enabled && automation.nextRunAt ? formatWhen(automation.nextRunAt) : "Paused"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Last run</dt>
          <dd className="mt-0.5">
            {automation.lastRun ? (
              <Link to={`/team?run=${automation.lastRun.id}`} className="inline-flex items-center gap-1.5 text-slate-800 hover:text-indigo-600">
                {lastRun && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${lastRun.pill}`}>{lastRun.label}</span>}
                {automation.lastRunAt && formatWhen(automation.lastRunAt)}<ArrowRight size={13} />
              </Link>
            ) : <span className="text-slate-500">Not run yet</span>}
          </dd>
        </div>
      </dl>

      {automation.lastNote && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><CircleAlert size={14} className="mt-0.5 shrink-0" />{automation.lastNote}</p>
      )}

      {editing && (
        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <ScheduleFields value={schedule} onChange={setSchedule} idPrefix={`edit-${automation.id}`} />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => { setSchedule(automation.schedule); setEditing(false); }}>Cancel</button>
            <button type="button" disabled={busy === "save"} onClick={saveSchedule} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
              {busy === "save" && <LoaderCircle size={14} className="animate-spin" />}Save schedule
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy)} onClick={runNow} className={secondaryBtn}>
          {busy === "run" ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}Run now
        </button>
        {!editing && <button type="button" onClick={() => setEditing(true)} className={secondaryBtn}><Pencil size={14} />Edit schedule</button>}
        <button type="button" disabled={Boolean(busy)} onClick={remove} className={`${secondaryBtn} ml-auto text-red-600 hover:bg-red-50`}><Trash2 size={14} />Delete</button>
      </div>
    </article>
  );
}

export default function Automations() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchAutomationsApi()
      .then((list) => active && setAutomations(list))
      .catch((loadError) => active && setError(errorMessage(loadError, "Failed to load automations.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const replace = (next) => setAutomations((list) => list.map((item) => (item.id === next.id ? next : item)));
  const remove = (id) => setAutomations((list) => list.filter((item) => item.id !== id));

  return (
    <AppShell
      title="Automations"
      subtitle="Your AI teams on autopilot · times are in IST"
      actions={
        <Link to="/team" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
          <Users size={15} /><span className="hidden sm:inline">New from AI Team</span>
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <section className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 p-5 text-white shadow-lg shadow-teal-500/20">
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid size-11 place-items-center rounded-xl bg-white/20"><CalendarClock size={20} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">Run your AI team on a schedule</h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-6 text-white/90">
                Build a team on the AI Team page, review its plan, then click <span className="font-semibold">Schedule</span>. It runs with exactly the agents and permissions you reviewed.
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-white/90"><ShieldCheck size={15} />Risky actions (sending email, creating events, posting) still wait for your approval, and you'll get an alert.</p>
        </section>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading && <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading automations…</div>}

        {!loading && !automations.length && !error && (
          <div className={`${card} flex flex-col items-center px-6 py-14 text-center`}>
            <span className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-600"><CalendarClock size={22} /></span>
            <p className="mt-3 text-sm font-semibold text-slate-900">No automations yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">Try: “Every weekday at 8 AM, read my unread emails and write me a to-do list.”</p>
            <Link to="/team" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
              Build a team <ArrowRight size={15} />
            </Link>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {automations.map((automation) => (
            <AutomationCard key={automation.id} automation={automation} onChange={replace} onDelete={remove} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
