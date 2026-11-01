import { Workflow } from "lucide-react";
import {LoginForm} from "../components/login-form";

function Login() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#2b2f3a_0%,#191b21_55%,#121317_100%)] px-4 py-12 text-white">
      {/* Background Effects */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]"
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.05] blur-[140px]" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Brand */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-white text-zinc-900 shadow-[0_10px_40px_rgba(255,255,255,0.12)]">
            <Workflow size={26} />
          </div>

          <p className="mt-4 text-sm font-medium tracking-tight text-zinc-200">
            AutoMate AI
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-9">
          <LoginForm />
        </div>

        {/* Footer */}
     

        <p className="mt-8 text-center text-xs text-zinc-600">
          Powered by intelligent automation
        </p>
      </div>
    </main>
  );
}

export default Login;