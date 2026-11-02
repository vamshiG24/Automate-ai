import { useState } from "react";
import { useSelector } from "react-redux";
import {
  Check,
  Zap,
  Crown,
  Users,
  Coins,
  ArrowRight,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import AppShell from "@/components/AppShell";

import { toast } from "sonner";
import api from "@/api";

const plans = [
  {
    id: "starter",
    name: "Starter",
    description: "Try AutoMate AI and explore the possibilities.",
    price: "Free",
    credits: 100,
    icon: Zap,
    features: [
      "100 free credits",
      "Basic AI chat",
      "Explore AI agents",
      "Standard access",
    ],
    buttonText: "Current Plan",
    disabled: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For developers who want to do more with AI.",
    price: 299,
    credits: 500,
    icon: Crown,
    features: [
      "500 credits",
      "Advanced AI conversations",
      "Access to AI tools",
      "Automate everyday tasks",
      "One-time payment",
    ],
    buttonText: "Get Pro",
    popular: true,
    disabled: false,
  },
  {
    id: "team",
    name: "Team",
    description: "More credits for demanding AI workflows.",
    price: 799,
    credits: 2000,
    icon: Users,
    features: [
      "2,000 credits",
      "Advanced AI conversations",
      "Access to AI tools",
      "Run complex workflows",
      "One-time payment",
    ],
    buttonText: "Get Team",
    disabled: false,
  },
];

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
};

// Soft colour tile per plan (presentation only)
const planTiles = {
  starter: "bg-amber-50 text-amber-600",
  pro: "bg-indigo-50 text-indigo-600",
  team: "bg-violet-50 text-violet-600",
};

function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const { user } = useSelector((state) => state.auth);

  const handlePurchase = async (planId) => {
    if (planId === "starter") return;

    try {
      setLoadingPlan(planId);

      // 1. Load Razorpay Checkout
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        toast.error("Unable to load Razorpay. Please try again.");
        return;
      }

      // 2. Create order through backend
      const { data: orderData } = await api.post(
        "/api/payment/create",
        {
          plan: planId,
        },
        {
          withCredentials: true,
        }
      );

      const { order, plan, key_id } = orderData;

      if (!order?.id || !key_id) {
        throw new Error("Invalid order response from server");
      }

      // 3. Open Razorpay Checkout
      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: "AutoMate AI",
        description: `${plan.name} Plan - ${plan.credits} Credits`,
        order_id: order.id,

        handler: async (response) => {
          try {
            // 4. Verify payment through backend
            const { data: verifyData } = await api.post(
              "/api/payment/verify",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              {
                withCredentials: true,
              }
            );

            toast.success(
              verifyData.message || "Payment verified successfully!"
            );

            // Refresh current page/user data if needed.
            // Add your auth-context user refresh here.
          } catch (error) {
            toast.error(
              error.response?.data?.message ||
                "Payment verification failed. Please contact support if money was deducted."
            );
          } finally {
            setLoadingPlan(null);
          }
        },

        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
          },
        },

        theme: {
          color: "#4f46e5",
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (response) => {
        toast.error(
          response.error?.description || "Payment failed. Please try again."
        );
        setLoadingPlan(null);
      });

      razorpay.open();
    } catch (error) {
      console.error("Purchase error:", error);

      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Unable to start payment. Please try again."
      );

      setLoadingPlan(null);
    }
  };

  return (
    <AppShell
      title="Credits & Plans"
      subtitle="Get the credits you need to chat with AI, use tools and automate tasks."
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {/* Current balance */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Coins className="size-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Current balance</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                {Number(user?.credits ?? 0).toLocaleString("en-IN")}{" "}
                <span className="text-sm font-medium text-slate-500">credits</span>
              </p>
            </div>
          </div>
          <p className="max-w-sm text-sm text-slate-500">
            Credits are one-time top-ups. They never expire and are used
            each time your agents run.
          </p>
        </div>

        {/* Section heading */}
        <div className="mt-8 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Choose a plan
          </h2>
          <p className="text-sm text-slate-500">
            Simple, transparent pricing. Pay once, no subscription.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-5 grid items-stretch gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isLoading = loadingPlan === plan.id;
            const isAnyPlanLoading = loadingPlan !== null;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
                  plan.popular
                    ? "border-indigo-500 ring-2 ring-indigo-500/15"
                    : "border-slate-200/80 hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${planTiles[plan.id] || "bg-indigo-50 text-indigo-600"}`}
                  >
                    <Icon className="size-5" />
                  </div>

                  {plan.popular && (
                    <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-medium text-white shadow-sm">
                      Most popular
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">
                  {plan.description}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  {plan.price !== "Free" && (
                    <span className="text-lg text-slate-400">₹</span>
                  )}
                  <span className="text-3xl font-semibold tracking-tight text-slate-900">
                    {plan.price}
                  </span>
                  {plan.price !== "Free" && (
                    <span className="text-sm text-slate-500">/ once</span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/70">
                  <Coins className="size-4 text-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">
                    {plan.credits.toLocaleString("en-IN")} credits
                  </span>
                </div>

                <p className="mt-5 text-xs font-medium uppercase tracking-wider text-slate-400">
                  What's included
                </p>

                <ul className="mt-3 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-slate-600"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  disabled={plan.disabled || isAnyPlanLoading}
                  onClick={() => handlePurchase(plan.id)}
                  variant={plan.popular ? "default" : "outline"}
                  className={`mt-6 h-11 w-full rounded-xl ${
                    plan.disabled
                      ? "border border-slate-200 bg-slate-50 text-slate-500 disabled:opacity-100"
                      : plan.popular
                        ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-1 size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {plan.buttonText}
                      {!plan.disabled && <ArrowRight className="ml-1 size-4" />}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-slate-500">
          Need help choosing a plan?{" "}
          <a
            href="mailto:support@automateai.com"
            className="font-medium text-indigo-600 underline-offset-4 hover:text-indigo-700 hover:underline"
          >
            Contact support
          </a>
        </p>
      </div>
    </AppShell>
  );
}

export default Pricing;
