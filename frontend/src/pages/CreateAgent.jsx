import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Bot, Check, Plus, Wrench } from "lucide-react";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAgentApi } from "@/features/agents/agentApi";

// ---------------- LIGHT UI ----------------

const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";

const fieldCls =
  "rounded-xl border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/15";

const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";

const availableTools = [

  {
    id: "web.search",
    name: "Web Search",
    description: "Search for information on the web",
  },
  {
    id: "gmail.read",
    name: "Read Emails",
    description: "Read and summarize emails",
  },
  {
    id: "gmail.send",
    name: "Send Emails",
    description: "Draft and send emails",
  },
  {
    id: "event.schedule",
    name: "schedule events",
    description: "Schdule Events On Google Calender",
  },
  {
    id: "image.analyze",
    name: "Analyze Image",
    description: "analyze image",
  },
  {
    id: "post.instagram",
    name: "Post on Instagram",
    description: "publish Post on Instagram",
  },
];

export default function CreateAgent() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    description: "",
    instructions: "",
    model: "openai/gpt-oss-120b",
    tools: [],
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toggleTool = (toolId) => {
    setForm((previous) => ({
      ...previous,
      tools: previous.tools.includes(toolId)
        ? previous.tools.filter((item) => item !== toolId)
        : [...previous.tools, toolId],
    }));
  };


const handleSubmit = async (event) => {
  event.preventDefault();
  setError("");

  if (!form.name.trim() || !form.instructions.trim()) {
    setError("Agent name and instructions are required.");
    return;
  }

  setSaving(true);

  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      instructions: form.instructions.trim(),
      model: form.model,
      tools: form.tools,
    };

    await createAgentApi(payload);

    navigate("/agents", {
      replace: true,
      state: {
        successMessage: "Agent created successfully!",
      },
    });
  } catch (error) {
    setError(
      error.response?.data?.message ||
        "Unable to create agent. Please try again."
    );
  } finally {
    setSaving(false);
  }
};

  return (
    <AppShell
      title="Create agent"
      subtitle="Configure your AI agent and define what it can do."
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
        {/* Intro */}
        <div className="mb-6 flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <Bot size={20} />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              New agent
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Give it a name, tell it how to behave and pick the tools it may use.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic details */}
          <section className={`space-y-5 p-5 sm:p-6 ${card}`}>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Basics
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                How the agent is named and what it is for.
              </p>
            </div>

            <div>
              <label htmlFor="agent-name" className={labelCls}>
                Agent name <span className="text-red-500">*</span>
              </label>

              <Input
                id="agent-name"
                value={form.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
                placeholder="e.g. Research Assistant"
                maxLength={100}
                required
                className={`h-11 px-3 ${fieldCls}`}
              />
            </div>

            <div>
              <label htmlFor="agent-description" className={labelCls}>
                Description
              </label>

              <Input
                id="agent-description"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="What does your agent do?"
                maxLength={500}
                className={`h-11 px-3 ${fieldCls}`}
              />
            </div>

            <div>
              <label htmlFor="agent-instructions" className={labelCls}>
                Instructions <span className="text-red-500">*</span>
              </label>

              <Textarea
                id="agent-instructions"
                value={form.instructions}
                onChange={(event) =>
                  updateField("instructions", event.target.value)
                }
                placeholder="You are a helpful AI assistant. Your job is to..."
                required
                className={`min-h-40 resize-y px-3 py-2.5 leading-6 ${fieldCls}`}
              />
            </div>

            {/* Model */}
            <div>
              <label htmlFor="agent-model" className={labelCls}>
                AI model
              </label>

              <select
                id="agent-model"
                value={form.model}
                onChange={(event) =>
                  updateField("model", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition [color-scheme:light] focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/15"
              >
                <option value="openai/gpt-oss-120b">
                  GPT-OSS 120B
                </option>

                <option value="openai/gpt-oss-20b">
                  GPT-OSS 20B
                </option>
              </select>
            </div>
          </section>

          {/* Tools */}
          <section className={`p-5 sm:p-6 ${card}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Tools
                </h3>

                <p className="mt-0.5 text-sm text-slate-500">
                  Select the capabilities available to your agent.
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-600/15">
                {form.tools.length} selected
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {availableTools.map((tool) => {
                const selected = form.tools.includes(tool.id);

                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => toggleTool(tool.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/15"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                        selected
                          ? "bg-indigo-100 text-indigo-600"
                          : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      <Wrench size={16} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {tool.name}
                      </span>

                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                        {tool.description}
                      </span>
                    </span>

                    <span
                      className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-md border ${
                        selected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white text-transparent"
                      }`}
                    >
                      {selected && <Check size={12} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle size={17} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="h-10 gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              {saving ? "Creating..." : "Create agent"}
              {!saving && <Plus size={16} />}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
