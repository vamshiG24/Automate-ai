import {
  CalendarDays, Check, Clock, ImagePlus, Mail, ShieldAlert, ShieldCheck, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const darkPanel =
  "border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";
const whiteBtn =
  "rounded-xl border-0 bg-white text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900";

const LEVEL_STYLES = {
  low: { label: "Low risk", pill: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20", bar: "bg-emerald-400" },
  medium: { label: "Medium risk", pill: "bg-amber-400/10 text-amber-300 border-amber-400/20", bar: "bg-amber-400" },
  high: { label: "High risk", pill: "bg-red-400/10 text-red-300 border-red-400/25", bar: "bg-red-400" },
};

// Risk score + the reasons behind it, from the backend risk engine
export function RiskPanel({ risk }) {
  if (!risk) return null;
  const style = LEVEL_STYLES[risk.level] ?? LEVEL_STYLES.medium;
  const Icon = risk.level === "low" ? ShieldCheck : ShieldAlert;

  return (
    <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.pill}`}>
          <Icon size={13} />{style.label}
        </span>
        <span className="text-xs tabular-nums text-zinc-400">Risk score {risk.score}/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="meter" aria-valuenow={risk.score} aria-valuemin={0} aria-valuemax={100} aria-label="Risk score">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(risk.score, 3)}%` }} />
      </div>
      {risk.reasons?.length > 0 && (
        <ul className="space-y-1">
          {risk.reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-xs leading-5 text-zinc-300">
              <span className={`mt-[7px] size-1.5 shrink-0 rounded-full ${style.bar}`} />{reason}
            </li>
          ))}
        </ul>
      )}
      {risk.trustSignals?.length > 0 && (
        <ul className="space-y-1">
          {risk.trustSignals.map((signal) => (
            <li key={signal} className="flex gap-2 text-xs leading-5 text-emerald-300/80">
              <Check size={12} className="mt-1 shrink-0" />{signal}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApprovalDetails({ approval }) {
  if (approval.type === "email") {
    return (
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
        <div><p className="mb-1 text-xs text-zinc-500">To</p><p className="break-all text-sm">{approval.email.to || "Not provided"}</p></div>
        <div><p className="mb-1 text-xs text-zinc-500">Subject</p><p className="text-sm">{approval.email.subject || "No subject"}</p></div>
        <div><p className="mb-1 text-xs text-zinc-500">Message</p><p className="whitespace-pre-wrap break-words text-sm text-zinc-300">{approval.email.body || "No message provided"}</p></div>
      </div>
    );
  }

  if (approval.type === "calendar") {
    const event = approval.event;
    const format = (value) => value
      ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone })
      : "Not provided";
    return (
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
        <div><p className="mb-1 text-xs text-zinc-500">Event title</p><p className="text-sm font-medium">{event.summary || "Untitled event"}</p></div>
        {event.description && <div><p className="mb-1 text-xs text-zinc-500">Description</p><p className="whitespace-pre-wrap text-sm text-zinc-300">{event.description}</p></div>}
        <div><p className="mb-1 text-xs text-zinc-500">Start</p><p className="flex items-center gap-2 text-sm"><CalendarDays size={15} />{format(event.startDateTime)}</p></div>
        <div><p className="mb-1 text-xs text-zinc-500">End</p><p className="flex items-center gap-2 text-sm"><Clock size={15} />{format(event.endDateTime)}</p></div>
        <p className="text-xs text-zinc-500">Timezone: {event.timeZone}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
      {approval.imageUrl && (
        <img src={approval.imageUrl} alt="Instagram post preview" className="max-h-72 w-full rounded-lg object-contain" />
      )}
      <div>
        <p className="mb-1 text-xs text-zinc-500">Caption</p>
        <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">{approval.caption || "No caption provided"}</p>
      </div>
      {approval.topic && <p className="text-xs text-zinc-400">Topic: {approval.topic}</p>}
      {approval.hashtags.length > 0 && <p className="break-words text-sm text-violet-300">{approval.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}</p>}
      {approval.imageUrl && <a href={approval.imageUrl} target="_blank" rel="noreferrer" className="break-all text-xs text-blue-300 underline">Open image URL</a>}
    </div>
  );
}

const COPY = {
  email: { title: "Email Approval Required", hint: "Review the email before sending.", approve: "Approve & Send", Icon: Mail, tone: "bg-amber-400/10 text-amber-400" },
  calendar: { title: "Calendar Approval Required", hint: "Review the event before creating it.", approve: "Approve & Create", Icon: CalendarDays, tone: "bg-violet-400/10 text-violet-400" },
  instagram: { title: "Instagram Publish Approval", hint: "Review the image and caption before publishing.", approve: "Approve & Publish", Icon: ImagePlus, tone: "bg-pink-400/10 text-pink-400" },
};

export default function ApprovalCard({ approval, loading, onDecision, className = "" }) {
  const copy = COPY[approval.type] ?? COPY.email;

  return (
    <div className={`rounded-2xl p-4 ${darkPanel} ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-xl ${copy.tone}`}>
          <copy.Icon className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{copy.title}</h3>
          <p className="text-xs text-zinc-400">{copy.hint}</p>
        </div>
      </div>
      <div className="space-y-3">
        <RiskPanel risk={approval.risk} />
        <ApprovalDetails approval={approval} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={loading} onClick={() => onDecision(false)} className="rounded-xl border-red-500/25 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"><X className="mr-2 size-4" />{loading ? "Processing..." : "Reject"}</Button>
        <Button type="button" disabled={loading} onClick={() => onDecision(true)} className={whiteBtn}><Check className="mr-2 size-4" />{loading ? "Processing..." : copy.approve}</Button>
      </div>
    </div>
  );
}
