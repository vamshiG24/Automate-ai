
import { cn } from "@/lib/utils";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useNavigate } from "react-router-dom";
import { loginApi } from "@/features/auth";
import { useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { setUser } from "@/redux/userSlice";

export function LoginForm({ className, ...props }) {

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
   const dispatch=useDispatch()
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      // Firebase Google Authentication
      const result = await signInWithPopup(auth, googleProvider);

      // Firebase ID token
      const firebaseToken = await result.user.getIdToken();

      // Send token in request body to backend
      const data=await loginApi(firebaseToken);
      dispatch(setUser(data.user))
      // Backend login successful; HttpOnly cookie is set
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Google login failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Welcome to AutoMate AI
        </h2>
        <p className="text-sm text-slate-500">
          Sign in to build and manage your AI agents.
        </p>
      </div>

      <form>
        <FieldGroup>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <p className="min-w-0 break-words">{error}</p>
            </div>
          )}

          <Field>
            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              variant="outline"
              type="button"
              className="h-12 w-full gap-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin text-slate-400" />
              ) : (
                <FcGoogle className="size-5" />
              )}
              {loading ? "Signing in..." : "Continue with Google"}
            </Button>
          </Field>

          <Field>
            <FieldDescription className="text-center text-xs leading-6 text-slate-500">
              By continuing, you agree to our{" "}
              <a
                href="/terms"
                className="font-medium text-slate-700 underline underline-offset-4 transition hover:text-indigo-600"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                className="font-medium text-slate-700 underline underline-offset-4 transition hover:text-indigo-600"
              >
                Privacy Policy
              </a>
              .
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
