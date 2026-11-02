import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import {
  fetchAgentsApi,
  deleteAgentApi,
} from "@/features/agents/agentApi";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------- LIGHT UI ----------------

const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";

const primaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700";

function Agents() {
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    // Initial state is already loading=true / error="", so we only
    // update state once the request settles.
    const loadAgents = async () => {
      try {
        const response = await fetchAgentsApi();

        const agentList = Array.isArray(response)
          ? response
          : response?.agents ??
            response?.data?.agents ??
            response?.data ??
            [];

        setAgents(Array.isArray(agentList) ? agentList : []);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load agents."
        );
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  const handleDelete = async (agent) => {
    const agentId = agent._id ?? agent.id;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${agent.name}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(agentId);
      setError("");

      await deleteAgentApi(agentId);

      setAgents((previous) =>
        previous.filter(
          (item) => (item._id ?? item.id) !== agentId
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to delete agent."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const query = search.toLowerCase();

    return (
      agent.name?.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query)
    );
  });

  return (
    <AppShell
      title="Agents"
      subtitle="Manage your AI agents and choose one to get started."
      actions={
        <Link
          to="/agents/new"
          className={`${primaryBtn} max-sm:size-9 max-sm:px-0`}
          aria-label="Create agent"
        >
          <Plus size={17} className="shrink-0" />
          <span className="hidden sm:inline">Create agent</span>
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {/* Page heading */}
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            My agents
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Custom agents you have built. Use one in chat or create a new one.
          </p>
        </div>

        {/* Search and count */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search agents..."
              className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/15"
            />
          </div>

          <span className="self-start rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-500/10 sm:self-auto">
            {agents.length} {agents.length === 1 ? "agent" : "agents"}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle size={17} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw size={22} className="animate-spin text-indigo-500" />
            <p className="text-sm">Loading your agents...</p>
          </div>
        ) : filteredAgents.length > 0 ? (
          /* Agent grid */
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => {
              const agentId = agent._id ?? agent.id;

              return (
                <article
                  key={agentId}
                  className={`group flex min-h-52 flex-col p-5 transition hover:border-slate-300 hover:shadow-md ${card}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
                      <Bot size={20} />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(agent)}
                      disabled={deletingId === agentId}
                      aria-label={`Delete ${agent.name}`}
                      title="Delete agent"
                      className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === agentId ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>

                  <h3 className="mt-4 truncate text-base font-semibold text-slate-900">
                    {agent.name || "Untitled Agent"}
                  </h3>

                  <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">
                    {agent.description || "No description provided."}
                  </p>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-600/15">
                      AI Agent
                    </span>

                    <Link
                      to="/"
                      state={{ selectedAgentId: agentId }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <span>Use agent</span>
                      <ArrowRight size={15} className="shrink-0 transition group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className={`mt-5 flex min-h-72 flex-col items-center justify-center px-5 py-10 text-center ${card}`}>
            <div className="grid size-12 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <Bot size={23} />
            </div>

            <h3 className="mt-4 text-base font-semibold text-slate-900">
              {search ? "No agents found" : "No agents yet"}
            </h3>

            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              {search
                ? "Try searching with another name or keyword."
                : "Create your first AI agent to get started."}
            </p>

            {search ? (
              <Button
                variant="outline"
                onClick={() => setSearch("")}
                className="mt-5 h-10 rounded-xl border border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                Clear search
              </Button>
            ) : (
              <Link to="/agents/new" className={`mt-5 ${primaryBtn}`}>
                <Plus size={17} className="shrink-0" />
                <span>Create agent</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default Agents;
