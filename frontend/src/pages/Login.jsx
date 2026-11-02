import { ShieldCheck, Users, Workflow, Mail, CalendarDays } from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import { LoginForm } from "../components/login-form";

const features = [
  {
    Icon: Users,
    title: "Agent Teams",
    text: "Give one instruction and a team of specialist agents splits up the work.",
  },
  {
    Icon: ShieldCheck,
    title: "Risk-scored approvals",
    text: "Every action gets a risk score. Anything risky waits for your OK.",
  },
  {
    Icon: Mail,
    title: "Gmail, Calendar & Instagram",
    text: "Send emails, schedule events and publish posts from one chat.",
  },
];

function Brand({ light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid size-10 place-items-center rounded-xl ${
          light
            ? "bg-white/20 text-white ring-1 ring-white/30"
            : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25"
        }`}
      >
        <Workflow size={20} />
      </span>
      <span
        className={`text-lg font-semibold tracking-tight ${
          light ? "text-white" : "text-slate-900"
        }`}
      >
        AutoMate AI
      </span>
    </div>
  );
}

function Login() {
  return (
    <main className="flex min-h-dvh w-full bg-[#f5f6fa] text-slate-900">
      {/* Left: brand panel (desktop only) */}
      <section className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-white/10" />

        <div className="relative">
          <Brand light />
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Your AI team that asks before it acts
          </h1>
          <p className="mt-4 text-base leading-7 text-white/85">
            Delegate everyday work to agents that plan, collaborate and check
            with you before doing anything risky.
          </p>

          <ul className="mt-10 space-y-5">
            {features.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 ring-1 ring-white/25">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm leading-6 text-white/80">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-3 text-sm text-white/80">
          <span className="flex items-center gap-1.5">
            <Mail size={15} /> Gmail
          </span>
          <span aria-hidden className="size-1 rounded-full bg-white/50" />
          <span className="flex items-center gap-1.5">
            <CalendarDays size={15} /> Calendar
          </span>
          <span aria-hidden className="size-1 rounded-full bg-white/50" />
          <span className="flex items-center gap-1.5">
            <FaInstagram size={14} /> Instagram
          </span>
        </div>
      </section>

      {/* Right: sign-in card */}
      <section className="flex w-full flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Brand />
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Powered by intelligent automation
          </p>
        </div>
      </section>
    </main>
  );
}

export default Login;
