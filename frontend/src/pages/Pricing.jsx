
import React, { useState } from "react";
import axios from "axios";
import {
  Check,
  Zap,
  Crown,
  Users,
  Coins,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

const cardBase = "border border-white/10 bg-white/[0.03]";

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

function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState(null);

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
          color: "#a78bfa",
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
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,#2b2f3a_0%,#191b21_55%,#121317_100%)] px-4 py-12 text-white sm:px-6 lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]"
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <Badge
            variant="outline"
            className="mb-5 rounded-full border-white/10 bg-white/[0.05] px-3 py-1 text-zinc-300 backdrop-blur-xl"
          >
            <Sparkles className="mr-2 h-3.5 w-3.5 text-violet-300" />
            Simple, transparent pricing
          </Badge>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Unlock more with{" "}
            <span className="text-violet-300/90">AutoMate AI.</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-500 sm:text-base">
            Get the credits you need to chat with AI, use powerful tools, and
            automate your everyday tasks.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid items-stretch gap-5 pt-3 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isLoading = loadingPlan === plan.id;
            const isAnyPlanLoading = loadingPlan !== null;

            return (
              <div key={plan.id} className="relative flex">
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border-0 bg-white px-3 py-1 text-zinc-900 hover:bg-white">
                    Most Popular
                  </Badge>
                )}

                <Card
                  className={`flex w-full flex-col gap-0 rounded-3xl border py-0 text-white shadow-none transition ${cardBase} ${
                    plan.popular
                      ? "border-white/40 bg-white/[0.06]"
                      : "hover:border-white/20"
                  }`}
                >
                  <CardHeader className="px-6 pb-5 pt-8">
                    <div
                      className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${
                        plan.popular
                          ? "bg-white text-zinc-900"
                          : "border border-white/10 bg-white/[0.06] text-zinc-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <CardTitle className="text-xl font-semibold text-white">
                      {plan.name}
                    </CardTitle>

                    <CardDescription className="min-h-10 text-sm leading-5 text-zinc-500">
                      {plan.description}
                    </CardDescription>

                    <div className="flex items-baseline gap-1 pt-3">
                      {plan.price !== "Free" && (
                        <span className="text-lg text-zinc-400">₹</span>
                      )}

                      <span className="text-4xl font-semibold tracking-tight text-white">
                        {plan.price}
                      </span>

                      {plan.price !== "Free" && (
                        <span className="text-sm text-zinc-500">/ once</span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <Coins className="h-4 w-4 text-violet-300" />
                      <span className="text-sm font-medium text-zinc-200">
                        {plan.credits.toLocaleString("en-IN")} credits
                      </span>
                    </div>
                  </CardHeader>

                  <Separator className="bg-white/[0.08]" />

                  <CardContent className="flex-1 px-6 py-6">
                    <p className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      What's included
                    </p>

                    <ul className="space-y-4">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 text-sm text-zinc-300"
                        >
                          <Check
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              plan.popular ? "text-white" : "text-zinc-500"
                            }`}
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="border-0 !bg-transparent px-6 pb-6 pt-0">
                    <Button
                      disabled={plan.disabled || isAnyPlanLoading}
                      onClick={() => handlePurchase(plan.id)}
                      className={`h-11 w-full rounded-xl disabled:opacity-100 ${
                        plan.popular
                          ? "border-0 bg-white font-medium text-zinc-900 hover:bg-zinc-200"
                          : "border border-white/10 bg-white/[0.05] text-white hover:bg-white/10 disabled:bg-white/[0.03] disabled:text-zinc-500"
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          {plan.buttonText}
                          {!plan.disabled && (
                            <ArrowRight className="ml-2 h-4 w-4" />
                          )}
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-white/[0.08] pt-6 text-center">
          <p className="text-sm text-zinc-500">
            Need help choosing a plan?{" "}
            <a
              href="mailto:support@automateai.com"
              className="text-zinc-300 underline-offset-4 transition hover:text-white hover:underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Pricing;
