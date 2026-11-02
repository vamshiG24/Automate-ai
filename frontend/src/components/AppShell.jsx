import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Activity, ArrowRight, Bell, Bot, CalendarClock, ChevronsUpDown, Coins, LogOut, MessagesSquare,
  PanelLeft, Plug, ShieldCheck, Sparkles, UserRound, Users, Workflow, X,
} from "lucide-react";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutApi, updateSettingsApi } from "@/features/auth.js";
import { fetchPendingApprovalsApi } from "@/features/automations";
import {
  alertApprovalNeeded, alertsEnabled, notificationsSupported,
  requestNotificationPermission, setAlertsEnabled,
} from "@/lib/alerts";
import { clearUser, setUser } from "@/redux/userSlice";

const NAV_KEY = "automate.navCollapsed";

// Each menu item gets its own soft colour tile, like a product dashboard
const NAV_ITEMS = [
  { to: "/", label: "Chat", Icon: MessagesSquare, tile: "bg-sky-50 text-sky-600", end: true },
  { to: "/team", label: "AI Team", Icon: Users, tile: "bg-rose-50 text-rose-500", badge: "approvals" },
  { to: "/automations", label: "Automations", Icon: CalendarClock, tile: "bg-teal-50 text-teal-600" },
  { to: "/agents", label: "Agents", Icon: Bot, tile: "bg-violet-50 text-violet-600" },
  { to: "/integrations", label: "Integrations", Icon: Plug, tile: "bg-emerald-50 text-emerald-600" },
  { to: "/activity", label: "Activity", Icon: Activity, tile: "bg-amber-50 text-amber-600" },
  { to: "/pricing", label: "Credits & Plans", Icon: Coins, tile: "bg-indigo-50 text-indigo-600" },
];

const menuContent =
  "rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl shadow-slate-900/10";
const menuItem = "cursor-pointer gap-2.5 rounded-xl py-2.5 text-slate-700 focus:bg-slate-100 focus:text-slate-900";

const POLL_MS = 20 * 1000;

// Watches for team runs (including scheduled ones) that wait for approval.
// A run that newly appears triggers a chime + desktop notification.
function usePendingApprovals() {
  const navigate = useNavigate();
  const [pending, setPending] = useState({ count: 0, runs: [] });
  const seen = useRef(null);

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const data = await fetchPendingApprovalsApi();
        if (!active) return;

        // The first check only records what is already waiting
        if (seen.current) {
          const fresh = data.runs.find((run) => !seen.current.has(String(run.id)));
          if (fresh) {
            alertApprovalNeeded({
              title: "Your AI team needs your approval",
              body: `${fresh.title}${fresh.trigger === "schedule" ? " (scheduled)" : ""} is waiting for you.`,
              tag: `automate-run-${fresh.id}`,
              onClick: () => navigate(`/team?run=${fresh.id}`),
            });
          }
        }

        seen.current = new Set(data.runs.map((run) => String(run.id)));
        setPending(data);
      } catch {
        // Offline or logged out: try again on the next tick
      }
    };

    const first = setTimeout(check, 0);
    const timer = setInterval(check, POLL_MS);
    window.addEventListener("focus", check);

    return () => {
      active = false;
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [navigate]);

  // "(1) AutoMate AI" in the browser tab while something waits
  useEffect(() => {
    document.title = pending.count ? `(${pending.count}) AutoMate AI` : "AutoMate AI";
  }, [pending.count]);

  return pending;
}

function readCollapsed() {
  try {
    return localStorage.getItem(NAV_KEY) === "1";
  } catch {
    return false;
  }
}

export function Avatar({ user, size = "size-9" }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-600 text-sm font-semibold text-white`}>
      {user?.profilePicture
        ? <img src={user.profilePicture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        : (user?.name?.[0]?.toUpperCase() || <UserRound size={16} />)}
    </span>
  );
}

function Sidebar({ onNavigate, onCollapse, pendingCount }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [loggingOut, setLoggingOut] = useState(false);
  const [alertsOn, setAlertsOn] = useState(alertsEnabled);

  const toggleAlerts = async () => {
    const next = !alertsOn;
    setAlertsOn(next);
    setAlertsEnabled(next);
    // Ask for desktop notifications from this click (browsers require it)
    if (next) await requestNotificationPermission();
  };

  const notificationsBlocked = notificationsSupported() && Notification.permission === "denied";

  // Lets the user check browser + Windows notification settings in one click.
  // The result is also shown in the menu, because a blocked browser shows no popup.
  const [testStatus, setTestStatus] = useState("");

  const sendTestAlert = async () => {
    const permission = await requestNotificationPermission();
    alertApprovalNeeded({
      title: "AutoMate AI test alert",
      body: "Desktop notifications are working.",
      tag: "automate-test",
      force: true,
    });
    setTestStatus(
      permission === "granted"
        ? "Sent ✓ If no popup appeared, check Windows notification settings."
        : permission === "unsupported"
          ? "This browser doesn't support desktop notifications (sound only)."
          : "Blocked in this browser: allow notifications from the lock icon in the address bar."
    );
  };

  const toggleAutoApprove = async () => {
    const next = !user?.autoApproveLowRisk;
    dispatch(setUser({ ...user, autoApproveLowRisk: next }));
    try {
      await updateSettingsApi({ autoApproveLowRisk: next });
    } catch {
      dispatch(setUser({ ...user, autoApproveLowRisk: !next }));
    }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutApi();
    } finally {
      dispatch(clearUser());
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
            <Workflow size={18} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-slate-900">AutoMate AI</span>
        </Link>
        <button type="button" onClick={onCollapse} aria-label="Close menu" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden">
          <X size={18} />
        </button>
      </div>

      {/* Workspace / credits card */}
      <Link
        to="/pricing"
        onClick={onNavigate}
        className="mx-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-slate-300"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Sparkles size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{user?.name?.split(" ")[0] || "My"}'s workspace</span>
          <span className="block text-xs text-slate-500">{Number(user?.credits ?? 0).toLocaleString("en-IN")} credits left</span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-slate-400" />
      </Link>

      <nav className="mt-6 min-h-0 flex-1 overflow-y-auto px-3" aria-label="Main">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Menu</p>
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, Icon, tile, end, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] transition-colors ${
                    isActive ? "bg-indigo-50/70 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                <span className={`grid size-9 place-items-center rounded-lg ${tile}`}><Icon size={18} /></span>
                <span className="flex-1">{label}</span>
                {badge === "approvals" && pendingCount > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-5 text-white" title={`${pendingCount} waiting for your approval`}>
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Promo card */}
      <div className="relative mx-3 mb-3 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 p-4 text-white shadow-lg shadow-fuchsia-500/20">
        <span aria-hidden className="absolute -right-10 -top-10 size-36 rounded-full bg-white/15" />
        <span className="relative grid size-10 place-items-center rounded-xl bg-white/20 backdrop-blur"><Sparkles size={18} /></span>
        <p className="relative mt-3 text-[15px] font-semibold">Build with your AI team</p>
        <p className="relative mt-1 text-[13px] leading-5 text-white/85">One instruction, a team of agents, and you approve anything risky.</p>
        <Link
          to="/team"
          onClick={onNavigate}
          className="relative mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-indigo-700 shadow-sm hover:bg-indigo-50"
        >
          Meet the team <ArrowRight size={14} />
        </Link>
      </div>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left outline-none hover:bg-slate-50 focus-visible:bg-slate-50">
          <Avatar user={user} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900">{user?.name || "User"}</span>
            <span className="block truncate text-xs text-slate-500">{user?.email}</span>
          </span>
          <ChevronsUpDown size={15} className="shrink-0 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className={`w-64 ${menuContent}`}>
          <DropdownMenuItem closeOnClick={false} onClick={toggleAutoApprove} className={menuItem}>
            <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">Auto-approve low risk</span>
              <span className="block text-[11px] text-slate-500">Skip the card for safe, familiar actions</span>
            </span>
            <span role="switch" aria-checked={Boolean(user?.autoApproveLowRisk)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${user?.autoApproveLowRisk ? "bg-emerald-500" : "bg-slate-200"}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${user?.autoApproveLowRisk ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem closeOnClick={false} onClick={toggleAlerts} className={menuItem}>
            <Bell size={16} className="shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">Approval alerts</span>
              <span className="block text-[11px] text-slate-500">{notificationsBlocked ? "Sound only: notifications are blocked in this browser" : "Sound + desktop notification"}</span>
            </span>
            <span role="switch" aria-checked={alertsOn} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${alertsOn ? "bg-amber-500" : "bg-slate-200"}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${alertsOn ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem closeOnClick={false} onClick={sendTestAlert} className={menuItem}>
            <Bell size={16} className="shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">Send test alert</span>
              {testStatus && <span className="block text-[11px] text-slate-500" role="status">{testStatus}</span>}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-100" />
          <DropdownMenuItem onClick={logout} disabled={loggingOut} className="cursor-pointer gap-2.5 rounded-xl py-2.5 text-red-600 focus:bg-red-50 focus:text-red-600">
            <LogOut size={16} />{loggingOut ? "Logging out..." : "Logout"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Layout for every signed-in page: left menu, top bar, content.
 * `actions` renders on the right of the top bar; `fullBleed` removes
 * the content padding/scroll (used by the chat page).
 */
export default function AppShell({ title, subtitle, actions, children, fullBleed = false }) {
  const { user } = useSelector((state) => state.auth);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pending = usePendingApprovals();

  useEffect(() => {
    try {
      localStorage.setItem(NAV_KEY, collapsed ? "1" : "0");
    } catch {
      // Storage can be blocked; the toggle still works for this visit
    }
  }, [collapsed]);

  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((value) => !value);
    else setMobileOpen(true);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f5f6fa] text-slate-900">
      {mobileOpen && (
        <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] lg:hidden" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[272px] shrink-0 border-r border-slate-200/80 max-lg:transition-transform max-lg:duration-200 lg:relative lg:z-auto lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:hidden" : ""}`}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} onCollapse={() => setMobileOpen(false)} pendingCount={pending.count} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" onClick={toggleMenu} aria-label="Toggle menu" title="Toggle menu" className="relative grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <PanelLeft size={19} />
            {pending.count > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500 lg:hidden" aria-label="Approval waiting" />}
          </button>
          <span className="h-6 w-px bg-slate-200" aria-hidden />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</p>}
          </div>
          {actions}
          <Link to="/pricing" className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-300 sm:flex">
            <Coins size={15} className="text-indigo-500" />
            <span className="tabular-nums">{Number(user?.credits ?? 0).toLocaleString("en-IN")}</span>
          </Link>
          <Avatar user={user} size="size-10" />
        </header>

        <main className={`min-h-0 flex-1 ${fullBleed ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
