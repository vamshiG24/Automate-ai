import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Lock, Plus, Sparkles, Trash2, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAgentApi } from "@/features/agents/agentApi";
import { seatColor } from "@/components/office/layout";

const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const fieldCls =
  "rounded-xl border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/15";
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";

const MAX_MEMBERS = 5;

// Ready-made teams for a quick start (each member = specific work + tools)
const TEMPLATES = [
  {
    label: "Email team",
    name: "Email Team",
    teamMode: "route",
    description: "Reads, writes and sends my emails",
    instructions: "Help me manage my Gmail: find and summarise emails, draft polite replies, and send them after my approval.",
    members: [
      { name: "Reader", role: "Find, read and summarise my emails. Mention sender, subject, date and any deadline.", tools: ["gmail.read"] },
      { name: "Writer", role: "Write short, polite email drafts and replies in a professional tone.", tools: [] },
      { name: "Sender", role: "Send the drafted email to the right person when I ask. Use the draft written by the Writer.", tools: ["gmail.send"] },
    ],
  },
  {
    label: "Planner team",
    name: "Planner Team",
    teamMode: "pipeline",
    description: "Turns my emails into calendar plans",
    instructions: "Help me plan my week from my emails and calendar, using Indian time.",
    members: [
      { name: "Inbox Reader", role: "Read my emails and pick out meetings, deadlines and dates.", tools: ["gmail.read"] },
      { name: "Scheduler", role: "Check my calendar and create events for meetings and deadlines. Default duration 30 minutes.", tools: ["event.schedule"] },
    ],
  },
  {
    label: "Study team",
    name: "Study Team",
    teamMode: "pipeline",
    description: "Explains topics, quizzes me and translates",
    instructions: "Help me study: explain topics simply, test me with quizzes, and translate notes to Hindi.",
    members: [
      { name: "Explainer", role: "Explain topics simply in short points with one example.", tools: [] },
      { name: "Quiz Master", role: "Make 3-5 short quiz questions on the topic and check my answers.", tools: [] },
      { name: "Translator", role: "Translate explanations into simple Hindi.", tools: [] },
    ],
  },
];

const emptyMember = () => ({ name: "", role: "", tools: [] });

export default function TeamBuilder({ availableTools }) {
  const navigate = useNavigate();
  const [team, setTeam] = useState({
    name: "",
    description: "",
    instructions: "",
    model: "openai/gpt-oss-120b",
    teamMode: "route",
    members: [emptyMember(), emptyMember()],
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field, value) => setTeam((previous) => ({ ...previous, [field]: value }));

  const updateMember = (index, patch) =>
    setTeam((previous) => ({
      ...previous,
      members: previous.members.map((member, position) => (position === index ? { ...member, ...patch } : member)),
    }));

  const toggleMemberTool = (index, toolId) => {
    const tools = team.members[index].tools;
    updateMember(index, { tools: tools.includes(toolId) ? tools.filter((tool) => tool !== toolId) : [...tools, toolId] });
  };

  const applyTemplate = (template) => {
    setError("");
    setTeam((previous) => ({
      ...previous,
      name: template.name,
      description: template.description,
      instructions: template.instructions,
      teamMode: template.teamMode,
      members: template.members.map((member) => ({ ...member, tools: [...member.tools] })),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!team.name.trim() || !team.instructions.trim()) {
      setError("Team name and team purpose are required.");
      return;
    }
    if (team.members.some((member) => !member.name.trim() || !member.role.trim())) {
      setError("Every member needs a name and a description of their work.");
      return;
    }

    setSaving(true);
    try {
      await createAgentApi({
        kind: "team",
        name: team.name.trim(),
        description: team.description.trim(),
        instructions: team.instructions.trim(),
        model: team.model,
        teamMode: team.teamMode,
        members: team.members.map((member) => ({ name: member.name.trim(), role: member.role.trim(), tools: member.tools })),
      });
      navigate("/agents", { replace: true });
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Unable to create the team. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Templates */}
      <section className={`p-5 ${card}`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles size={16} className="text-violet-500" />Start from a template</div>
        <p className="mt-0.5 text-sm text-slate-500">Fills in the members for you. You can change anything afterwards.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TEMPLATES.map((template) => (
            <button key={template.label} type="button" onClick={() => applyTemplate(template)} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700">
              {template.label}
            </button>
          ))}
        </div>
      </section>

      {/* Team basics */}
      <section className={`space-y-5 p-5 sm:p-6 ${card}`}>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Team</h3>
          <p className="mt-0.5 text-sm text-slate-500">You chat with the whole team. A coordinator passes each message to the right member.</p>
        </div>
        <div>
          <label htmlFor="team-name" className={labelCls}>Team name <span className="text-red-500">*</span></label>
          <Input id="team-name" value={team.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Email Team" maxLength={100} required className={`h-11 px-3 ${fieldCls}`} />
        </div>
        <div>
          <label htmlFor="team-description" className={labelCls}>Description</label>
          <Input id="team-description" value={team.description} onChange={(event) => update("description", event.target.value)} placeholder="What does this team do?" maxLength={500} className={`h-11 px-3 ${fieldCls}`} />
        </div>
        <div>
          <label htmlFor="team-purpose" className={labelCls}>Team purpose <span className="text-red-500">*</span></label>
          <Textarea id="team-purpose" value={team.instructions} onChange={(event) => update("instructions", event.target.value)} placeholder="e.g. Help me manage my Gmail: read, draft and send emails." required className={`min-h-24 resize-y px-3 py-2.5 leading-6 ${fieldCls}`} />
        </div>
        <fieldset>
          <legend className={labelCls}>How the team works</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: "route", title: "Smart routing", text: "A coordinator sends each message only to the members it needs. Best for an email or planner team." },
              { value: "pipeline", title: "Full pipeline", text: "Every message goes through all members in order (e.g. explain → quiz → translate)." },
            ].map((option) => (
              <label key={option.value} className={`cursor-pointer rounded-xl border p-3 transition ${team.teamMode === option.value ? "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" name="team-mode" value={option.value} checked={team.teamMode === option.value} onChange={() => update("teamMode", option.value)} className="sr-only" />
                <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{option.text}</span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">You can switch this any time from the chat.</p>
        </fieldset>
        <div>
          <label htmlFor="team-model" className={labelCls}>AI model for members</label>
          <select id="team-model" value={team.model} onChange={(event) => update("model", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/15">
            <option value="openai/gpt-oss-120b">GPT-OSS 120B (smarter)</option>
            <option value="openai/gpt-oss-20b">GPT-OSS 20B (faster, fewer rate limits)</option>
          </select>
        </div>
      </section>

      {/* Members */}
      <section className={`p-5 sm:p-6 ${card}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Members</h3>
            <p className="mt-0.5 text-sm text-slate-500">Give each member one specific job and only the tools that job needs.</p>
          </div>
          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-600/15">{team.members.length} / {MAX_MEMBERS}</span>
        </div>

        <ol className="space-y-4">
          {team.members.map((member, index) => (
            <li key={index} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: seatColor(index) }}>
                  {member.name.trim().slice(0, 1).toUpperCase() || index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <Input value={member.name} onChange={(event) => updateMember(index, { name: event.target.value })} placeholder={`Member ${index + 1} name, e.g. Reader`} maxLength={40} aria-label={`Member ${index + 1} name`} className={`h-10 px-3 ${fieldCls}`} />
                  <Textarea value={member.role} onChange={(event) => updateMember(index, { role: event.target.value })} placeholder="Specific work, e.g. Find and summarise my unread emails." maxLength={1000} aria-label={`Member ${index + 1} work`} className={`min-h-20 resize-y px-3 py-2 leading-6 ${fieldCls}`} />
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-500"><Lock size={11} />Tools for {member.name.trim() || "this member"}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTools.map((tool) => {
                        const selected = member.tools.includes(tool.id);
                        return (
                          <button key={tool.id} type="button" aria-pressed={selected} onClick={() => toggleMemberTool(index, tool.id)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${selected ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                            {tool.name}
                          </button>
                        );
                      })}
                    </div>
                    {!member.tools.length && <p className="mt-1.5 text-[11px] text-slate-400">No tools: this member only thinks and writes.</p>}
                  </div>
                </div>
                {team.members.length > 2 && (
                  <button type="button" onClick={() => update("members", team.members.filter((_, position) => position !== index))} aria-label={`Remove member ${index + 1}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>

        {team.members.length < MAX_MEMBERS && (
          <button type="button" onClick={() => update("members", [...team.members, emptyMember()])} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-700">
            <Plus size={16} />Add member
          </button>
        )}
      </section>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button type="button" onClick={() => navigate("/agents")} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
          {saving ? "Creating team..." : <>Create team <Users size={16} /></>}
        </button>
      </div>
    </form>
  );
}
