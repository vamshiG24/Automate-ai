
import { cn } from "@/lib/utils";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
console.log(data)
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
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight text-white">
            Welcome to Automate AI
          </CardTitle>

          <CardDescription className="text-sm text-zinc-400">
            Sign in to build and manage your AI agents.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form>
            <FieldGroup>
              <Field>
                <Button
                onClick={handleGoogleLogin}
                  variant="outline"
                  type="button"
                  className="h-12 w-full gap-3 rounded-xl border-white/15 bg-white/[0.04] text-sm font-medium text-white transition hover:border-violet-400/50 hover:bg-white/[0.08] hover:text-white"
                >
                <FcGoogle/>

                  Continue with Google
                </Button>
              </Field>

              <Field>
                <FieldDescription className="pt-3 text-center text-xs leading-6 text-zinc-500">
                  By continuing, you agree to our{" "}
                  <a
                    href="/terms"
                    className="text-zinc-300 underline underline-offset-4 transition hover:text-white"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="/privacy"
                    className="text-zinc-300 underline underline-offset-4 transition hover:text-white"
                  >
                    Privacy Policy
                  </a>
                  .
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
