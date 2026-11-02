import {
  CalendarDays, Check, Clock, ImagePlus, Mail, ShieldAlert, ShieldCheck, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const panel = "border border-slate-200/80 bg-white shadow-sm";
const primaryBtn = "rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700";
const detailBox = "space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5";

const LEVEL_STYLES = {
  low: { label: "Low risk", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" },
  medium: { label: "Medium risk", pill: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500" },
  high: { label: "High risk", pill: "bg-red-50 text-red-700 border-red-200", bar: "bg-red-500" },
};

// Risk score + the reasons behind it, from the backend risk engine
export function RiskPanel({ risk }) {
  if (!risk) return null;
  const style = LEVEL_STYLES[risk.level] ?? LEVEL_STYLES.medium;
  const Icon = risk.level === "low" ? ShieldCheck : ShieldAlert;

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.pill}`}>
          <Icon size={13} />{style.label}
        </span>
        <span className="text-xs tabular-nums text-slate-500">Risk score {risk.score}/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={risk.score} aria-valuemin={0} aria-valuemax={100} aria-label="Risk score">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(risk.score, 3)}%` }} />
      </div>
      {risk.reasons?.length > 0 && (
        <ul className="space-y-1">
          {risk.reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-xs leading-5 text-slate-700">
              <span className={`mt-[7px] size-1.5 shrink-0 rounded-full ${style.bar}`} />{reason}
            </li>
          ))}
        </ul>
      )}
      {risk.trustSignals?.length > 0 && (
        <ul className="space-y-1">
          {risk.trustSignals.map((signal) => (
            <li key={signal} className="flex gap-2 text-xs leading-5 text-emerald-700">
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
      <div className={detailBox}>
        <div><p className="mb-1 text-xs text-slate-500">To</p><p className="break-all text-sm text-slate-900">{approval.email.to || "Not provided"}</p></div>
        <div><p className="mb-1 text-xs text-slate-500">Subject</p><p className="text-sm text-slate-900">{approval.email.subject || "No subject"}</p></div>
        <div><p className="mb-1 text-xs text-slate-500">Message</p><p className="whitespace-pre-wrap break-words text-sm text-slate-700">{approval.email.body || "No message provided"}</p></div>
      </div>
    );
  }

  if (approval.type === "calendar") {
    const event = approval.event;
    const format = (value) => value
      ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone })
      : "Not provided";
    return (
      <div className={detailBox}>
        <div><p className="mb-1 text-xs text-slate-500">Event title</p><p className="text-sm font-medium text-slate-900">{event.summary || "Untitled event"}</p></div>
        {event.description && <div><p className="mb-1 text-xs text-slate-500">Description</p><p className="whitespace-pre-wrap text-sm text-slate-700">{event.description}</p></div>}
        <div><p className="mb-1 text-xs text-slate-500">Start</p><p className="flex items-center gap-2 text-sm text-slate-800"><CalendarDays size={15} />{format(event.startDateTime)}</p></div>
        <div><p className="mb-1 text-xs text-slate-500">End</p><p className="flex items-center gap-2 text-sm text-slate-800"><Clock size={15} />{format(event.endDateTime)}</p></div>
        <p className="text-xs text-slate-500">Timezone: {event.timeZone}</p>
      </div>
    );
  }

  return (
    <div className={detailBox}>
      {approval.imageUrl && (
        <img src={approval.imageUrl} alt="Instagram post preview" className="max-h-72 w-full rounded-lg object-contain" />
      )}
      <div>
        <p className="mb-1 text-xs text-slate-500">Caption</p>
        <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{approval.caption || "No caption provided"}</p>
      </div>
      {approval.topic && <p className="text-xs text-slate-500">Topic: {approval.topic}</p>}
      {approval.hashtags.length > 0 && <p className="break-words text-sm text-violet-600">{approval.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}</p>}
      {approval.imageUrl && <a href={approval.imageUrl} target="_blank" rel="noreferrer" className="break-all text-xs text-indigo-600 underline">Open image URL</a>}
    </div>
  );
}

const COPY = {
  email: { title: "Email Approval Required", hint: "Review the email before sending.", approve: "Approve & Send", Icon: Mail, tone: "bg-amber-50 text-amber-600" },
  calendar: { title: "Calendar Approval Required", hint: "Review the event before creating it.", approve: "Approve & Create", Icon: CalendarDays, tone: "bg-violet-50 text-violet-600" },
  instagram: { title: "Instagram Publish Approval", hint: "Review the image and caption before publishing.", approve: "Approve & Publish", Icon: ImagePlus, tone: "bg-pink-50 text-pink-600" },
};

export default function ApprovalCard({ approval, loading, onDecision, className = "" }) {
  const copy = COPY[approval.type] ?? COPY.email;

  return (
    <div className={`rounded-2xl p-4 ${panel} ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-xl ${copy.tone}`}>
          <copy.Icon className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{copy.title}</h3>
          <p className="text-xs text-slate-500">{copy.hint}</p>
        </div>
      </div>
      <div className="space-y-3">
        <RiskPanel risk={approval.risk} />
        <ApprovalDetails approval={approval} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={loading} onClick={() => onDecision(false)} className="rounded-xl border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"><X className="mr-2 size-4" />{loading ? "Processing..." : "Reject"}</Button>
        <Button type="button" disabled={loading} onClick={() => onDecision(true)} className={primaryBtn}><Check className="mr-2 size-4" />{loading ? "Processing..." : copy.approve}</Button>
      </div>
    </div>
  );
}
