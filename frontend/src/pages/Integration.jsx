import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  CalendarDays,
  Check,
  ArrowUpRight,
  Unplug,
  Loader2,
  ShieldCheck,
  CircleAlert,
  CircleCheck,
} from "lucide-react";
import { FaInstagram } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import AppShell from "@/components/AppShell";
import api from "@/api";

// Soft colour tile per integration (presentation only)
const tileStyles = {
  gmail: "bg-red-50 text-red-600",
  googleCalendar: "bg-sky-50 text-sky-600",
  instagram: "bg-pink-50 text-pink-600",
};

const integrationList = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Send and manage emails through your AI agent.",
    icon: Mail,
    provider: "google",
  },
  {
    id: "googleCalendar",
    name: "Google Calendar",
    description: "Manage calendar events using your AI agent.",
    icon: CalendarDays,
    provider: "google",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Publish images with AI-generated captions and hashtags.",
    icon: FaInstagram,
    provider: "instagram",
  },
];

// Result of an OAuth redirect (?google=connected, ?instagram=error, ...)
function readOAuthResult() {
  const params = new URLSearchParams(window.location.search);
  const googleStatus = params.get("google");
  const instagramStatus = params.get("instagram");
  const oauthError = params.get("error");

  if (googleStatus === "connected") return { success: "Google account connected successfully.", error: "" };
  if (instagramStatus === "connected") return { success: "Instagram account connected successfully.", error: "" };
  if (instagramStatus === "no_business_account") {
    return {
      success: "",
      error: "No Instagram business account found. Link your Instagram professional account to a Facebook Page and try again.",
    };
  }
  if (oauthError || googleStatus === "error" || instagramStatus === "error") {
    return { success: "", error: "Account connection failed. Please try again." };
  }
  return { success: "", error: "" };
}

export default function Integrations() {
  const [oauthResult] = useState(readOAuthResult);
  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [error, setError] = useState(oauthResult.error);
  const [success, setSuccess] = useState(oauthResult.success);

  const fetchIntegrations = useCallback(async () => {
    try {
      const { data } = await api.get("/api/integrations");

      setIntegrations(data.integrations || {});
    } catch (err) {
      console.error("Failed to fetch integrations:", err);

      setError(
        err.response?.data?.message ||
          "Failed to load integrations. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Remove the OAuth result from the URL so a refresh doesn't repeat it
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    let active = true;
    api.get("/api/integrations")
      .then(({ data }) => active && setIntegrations(data.integrations || {}))
      .catch((err) => {
        console.error("Failed to fetch integrations:", err);
        if (active) setError(err.response?.data?.message || "Failed to load integrations. Please try again.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const handleConnect = async (id) => {
    try {
      setConnecting(id);
      setError("");
      setSuccess("");

      if (id === "gmail" || id === "googleCalendar") {
        const { data } = await api.get(
          "/api/integrations/google/connect"
        );

        if (!data.success || !data.url) {
          throw new Error("Google authorization URL not received.");
        }

        window.location.assign(data.url);
        return;
      }

      if (id === "instagram") {
        const { data } = await api.get(
          "/api/integrations/instagram/auth"
        );

        if (!data.success || !data.url) {
          throw new Error("Instagram authorization URL not received.");
        }

        window.location.assign(data.url);
        return;
      }
    } catch (err) {
      console.error("Integration connection failed:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to connect integration."
      );

      setConnecting(null);
    }
  };

  const handleDisconnect = async (id) => {
    const integration = integrationList.find((item) => item.id === id);

    if (!integration) return;

    const confirmed = window.confirm(
      `Are you sure you want to disconnect ${integration.name}?`
    );

    if (!confirmed) return;

    try {
      setDisconnecting(id);
      setError("");
      setSuccess("");

      if (integration.provider === "google") {
        await api.post("/api/integrations/google/disconnect");
      } else if (integration.provider === "instagram") {
        await api.post("/api/integrations/instagram/disconnect");
      }

      setSuccess(`${integration.name} disconnected successfully.`);

      await fetchIntegrations();
    } catch (err) {
      console.error("Integration disconnection failed:", err);

      setError(
        err.response?.data?.message ||
          `Failed to disconnect ${integration.name}.`
      );
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <AppShell
      title="Integrations"
      subtitle="Connect your accounts and let AutoMate AI handle tasks for you."
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Connected apps
          </h2>
          <p className="text-sm text-slate-500">
            Your agents can only use the accounts you connect here.
          </p>
        </div>

        {(error || success) && (
          <div className="mt-5 space-y-3">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                <CircleCheck className="mt-0.5 size-4 shrink-0" />
                <p>{success}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrationList.map((item) => {
            const integration = integrations[item.id];
            const connected = Boolean(integration?.connected);
            const Icon = item.icon;

            const isConnecting = connecting === item.id;
            const isDisconnecting =
              disconnecting === item.id ||
              (item.provider === "google" &&
                disconnecting !== null &&
                integrationList.find(
                  (entry) => entry.id === disconnecting
                )?.provider === "google");

            const accountLabel = connected
              ? integration.email ||
                integration.username ||
                integration.displayName ||
                ""
              : "";

            return (
              <div
                key={item.id}
                className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${tileStyles[item.id] || "bg-indigo-50 text-indigo-600"}`}
                  >
                    <Icon className="size-5" />
                  </div>

                  {loading ? (
                    <span className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
                  ) : connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/15">
                      <Check className="size-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-500/15">
                      Not connected
                    </span>
                  )}
                </div>

                <h3 className="mt-4 font-semibold text-slate-900">
                  {item.name}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {item.description}
                </p>

                {accountLabel && (
                  <p className="mt-2 truncate text-xs text-slate-500" title={accountLabel}>
                    {accountLabel}
                  </p>
                )}

                <div className="mt-auto flex pt-5">
                  {connected ? (
                    <Button
                      variant="outline"
                      disabled={loading || isDisconnecting}
                      onClick={() => handleDisconnect(item.id)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-600"
                    >
                      {isDisconnecting ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : (
                        <Unplug className="mr-1 size-4" />
                      )}
                      {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      disabled={loading || isConnecting}
                      onClick={() => handleConnect(item.id)}
                      className="h-10 w-full rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                    >
                      {isConnecting && (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      )}
                      {loading
                        ? "Loading..."
                        : isConnecting
                          ? "Connecting..."
                          : "Connect"}

                      {!loading && !isConnecting && (
                        <ArrowUpRight className="ml-1 size-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p>
            Your account credentials are not displayed here. Connected
            integrations are managed securely by AutoMate AI.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
