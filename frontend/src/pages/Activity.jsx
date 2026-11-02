import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, CircleCheck, CircleX, ImagePlus, LoaderCircle, Mail,
  MessagesSquare, ShieldAlert, ShieldCheck, Sparkles, Users,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import { fetchApprovalStatsApi, fetchTeamRunsApi } from "@/features/team";
import { fetchConversationsApi } from "@/features/conversations";

const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";

const TOOL = {
  send_email: { label: "Email", Icon: Mail, tile: "bg-red-50 text-red-500" },
  create_calendar_event: { label: "Calendar event", Icon: CalendarDays, tile: "bg-sky-50 text-sky-600" },
  publish_instagram_image: { label: "Instagram post", Icon: ImagePlus, tile: "bg-pink-50 text-pink-600" },
};

const LEVEL = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/15",
  high: "bg-red-50 text-red-700 ring-red-600/15",
};

const RUN_LABEL = {
  planned: "planned",
  running: "is running",
  waiting_approval: "is waiting for approval",
  completed: "completed",
  failed: "finished with errors",
};

const timeAgo = (date) => {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function StatCard({ label, value, hint, Icon, tile }) {
  return (
    <div className={`${card} p-5`}>
      <span className={`grid size-10 place-items-center rounded-xl ${tile}`}><Icon size={18} /></span>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function Activity() {
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchApprovalStatsApi(), fetchTeamRunsApi(), fetchConversationsApi()])
      .then(([safety, teamRuns, conversations]) => {
        if (!active) return;
        setStats(safety);
        setRuns(teamRuns);
        setChats(conversations);
      })
      .catch((loadError) => active && setError(loadError?.response?.data?.message || "Failed to load activity."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  // One timeline from approvals, team runs and chats
  const timeline = useMemo(() => {
    const decisions = (stats?.recent ?? []).map((item) => {
      const tool = TOOL[item.toolName] ?? { label: item.toolName, Icon: ShieldCheck, tile: "bg-slate-100 text-slate-600" };
      const verdict = item.autoApproved ? "auto-approved" : item.approved ? "approved by you" : "rejected by you";
      return {
        id: `d-${item._id}`,
        at: item.createdAt,
        Icon: tool.Icon,
        tile: tool.tile,
        title: `${tool.label}${item.toolName === "send_email" ? ` to ${item.target}` : ""} ${verdict}`,
        meta: `${item.source === "team" ? "AI Team" : "Chat"} · risk ${item.riskScore}/100`,
        badge: item.riskLevel,
        link: null,
      };
    });
    const teamItems = runs.map((run) => ({
      id: `t-${run.id}`,
      at: run.createdAt,
      Icon: Users,
      tile: "bg-rose-50 text-rose-500",
      title: `Team "${run.title}" ${RUN_LABEL[run.status] ?? run.status}`,
      meta: `${run.stepCount} agent${run.stepCount === 1 ? "" : "s"}`,
      link: `/team?run=${run.id}`,
    }));
    const chatItems = chats.slice(0, 20).map((chat) => ({
      id: `c-${chat.threadId}`,
      at: chat.updatedAt,
      Icon: MessagesSquare,
      tile: "bg-sky-50 text-sky-600",
      title: `Chat "${chat.title}"`,
      meta: chat.agentName ? `with ${chat.agentName}` : "General chat",
      link: null,
    }));

    return [...decisions, ...teamItems, ...chatItems]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 40);
  }, [stats, runs, chats]);

  const levels = stats?.byLevel ?? { low: { total: 0 }, medium: { total: 0 }, high: { total: 0 } };
  const levelTotal = Math.max(1, levels.low.total + levels.medium.total + levels.high.total);

  return (
    <AppShell title="Activity" subtitle="Everything your agents did, and every safety decision">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Actions risk-checked" value={stats?.total ?? 0} hint="Emails, events and posts" Icon={ShieldCheck} tile="bg-indigo-50 text-indigo-600" />
          <StatCard label="Auto-approved" value={stats?.autoApproved ?? 0} hint={`${stats?.clicksSavedPercent ?? 0}% of approval clicks saved`} Icon={CircleCheck} tile="bg-emerald-50 text-emerald-600" />
          <StatCard label="Rejected by you" value={stats?.rejected ?? 0} hint="Nothing was sent" Icon={CircleX} tile="bg-red-50 text-red-600" />
          <StatCard label="Injection attempts" value={stats?.injectionFlags ?? 0} hint="Flagged as high risk" Icon={ShieldAlert} tile="bg-amber-50 text-amber-600" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className={`${card} p-5`} aria-label="Timeline">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Recent activity</h2>
            <p className="text-sm text-slate-500">Approvals, team runs and chats, newest first.</p>

            {loading && (
              <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading activity…</div>
            )}

            {!loading && !timeline.length && (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Sparkles size={20} /></span>
                <p className="mt-3 text-sm font-medium text-slate-900">Nothing here yet</p>
                <p className="mt-1 text-sm text-slate-500">Start a chat or give your AI team a task.</p>
                <Link to="/team" className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">Open AI Team</Link>
              </div>
            )}

            <ol className="mt-4">
              {timeline.map((item, index) => {
                const body = (
                  <>
                    <span className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-xl ${item.tile}`}><item.Icon size={16} /></span>
                    <span className="min-w-0 flex-1 pb-5">
                      <span className="block text-sm font-medium text-slate-800">{item.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {item.meta}
                        {item.badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ${LEVEL[item.badge]}`}>{item.badge} risk</span>}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-xs text-slate-400">{timeAgo(item.at)}</span>
                  </>
                );
                return (
                  <li key={item.id} className="relative">
                    {index < timeline.length - 1 && <span aria-hidden className="absolute left-[17px] top-9 bottom-0 w-px bg-slate-200" />}
                    {item.link
                      ? <Link to={item.link} className="-mx-2 flex gap-3 rounded-xl px-2 pt-1 hover:bg-slate-50">{body}</Link>
                      : <div className="flex gap-3 pt-1">{body}</div>}
                  </li>
                );
              })}
            </ol>
          </section>

          <aside className="space-y-6">
            <section className={`${card} p-5`} aria-label="Risk levels">
              <h2 className="text-sm font-semibold text-slate-900">Actions by risk level</h2>
              <p className="mb-4 text-xs text-slate-500">How the risk engine scored your agents' actions.</p>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                <span className="bg-emerald-500" style={{ width: `${(levels.low.total / levelTotal) * 100}%` }} />
                <span className="bg-amber-500" style={{ width: `${(levels.medium.total / levelTotal) * 100}%` }} />
                <span className="bg-red-500" style={{ width: `${(levels.high.total / levelTotal) * 100}%` }} />
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[["low", "Low", "bg-emerald-500"], ["medium", "Medium", "bg-amber-500"], ["high", "High", "bg-red-500"]].map(([key, name, dot]) => (
                  <li key={key} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600"><span className={`size-2.5 rounded-full ${dot}`} />{name}</span>
                    <span className="tabular-nums text-slate-500">
                      <span className="font-medium text-slate-900">{levels[key].total}</span> · {levels[key].approved} approved
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white shadow-lg shadow-indigo-500/20">
              <ShieldCheck size={20} />
              <p className="mt-3 text-[15px] font-semibold">How approvals work</p>
              <p className="mt-1 text-[13px] leading-5 text-white/85">
                Every email, event and post gets a risk score. Recipients taken from emails or other agents are flagged as possible prompt injection. Sensitive data always needs your click.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
