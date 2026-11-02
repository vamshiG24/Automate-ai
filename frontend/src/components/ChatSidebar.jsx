import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Ellipsis, MessageSquare, PanelLeftClose, Pencil, Pin,
  PinOff, Search, SquarePen, Trash2, Users, X,
} from "lucide-react";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const hideScrollbar =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const menuContent =
  "rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl shadow-slate-900/10";
const menuItem = "cursor-pointer gap-2.5 rounded-xl py-2 text-slate-700 focus:bg-slate-100 focus:text-slate-900";

const DAY = 24 * 60 * 60 * 1000;

// Bucket conversations like ChatGPT: Pinned, Today, Yesterday, ...
function groupConversations(conversations) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();

  const groups = [
    { label: "Pinned", items: [] },
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Previous 30 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conversation of conversations) {
    const time = new Date(conversation.updatedAt).getTime();

    if (conversation.pinned) groups[0].items.push(conversation);
    else if (time >= today) groups[1].items.push(conversation);
    else if (time >= today - DAY) groups[2].items.push(conversation);
    else if (time >= today - 7 * DAY) groups[3].items.push(conversation);
    else if (time >= today - 30 * DAY) groups[4].items.push(conversation);
    else groups[5].items.push(conversation);
  }

  return groups.filter((group) => group.items.length);
}

function ConversationItem({ conversation, active, disabled, onSelect, onRename, onTogglePin, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const saveTitle = () => {
    setEditing(false);
    const next = title.trim();
    if (next && next !== conversation.title) onRename(conversation.threadId, next);
    else setTitle(conversation.title);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") saveTitle();
          if (event.key === "Escape") { setTitle(conversation.title); setEditing(false); }
        }}
        className="w-full rounded-xl border border-indigo-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-2 ring-indigo-500/15"
        aria-label="Conversation title"
      />
    );
  }

  return (
    <div className={`group relative flex items-center rounded-xl transition-colors ${active ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(conversation.threadId)}
        title={conversation.title}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left disabled:cursor-not-allowed"
      >
        {conversation.kind === "team"
          ? <Users size={15} className="shrink-0 text-rose-500" />
          : conversation.agentId
            ? <Bot size={15} className="shrink-0 text-violet-500" />
            : <MessageSquare size={15} className="shrink-0 text-slate-400" />}
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] ${active ? "font-medium text-slate-900" : "text-slate-700"}`}>{conversation.title}</span>
          {conversation.agentName && <span className="block truncate text-[11px] text-slate-400">{conversation.agentName}</span>}
        </span>
        {conversation.hasPendingApproval && (
          <span className="size-2 shrink-0 rounded-full bg-amber-500" title="Waiting for your approval" />
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Conversation options"
          className={`mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 outline-none hover:bg-slate-200/70 hover:text-slate-700 focus-visible:opacity-100 data-[popup-open]:opacity-100 ${active ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"}`}
        >
          <Ellipsis size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={`w-44 ${menuContent}`}>
          <DropdownMenuItem onClick={() => setEditing(true)} className={menuItem}>
            <Pencil size={14} />Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onTogglePin(conversation)} className={menuItem}>
            {conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            {conversation.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-100" />
          <DropdownMenuItem
            onClick={() => onDelete(conversation)}
            className="cursor-pointer gap-2.5 rounded-xl py-2 text-red-600 focus:bg-red-50 focus:text-red-600"
          >
            <Trash2 size={14} />Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function ChatSidebar({
  conversations,
  agentName,
  scope,
  onScopeChange,
  loading,
  error,
  activeThreadId,
  disabled,
  search,
  onSearchChange,
  onSelect,
  onNewChat,
  onRename,
  onTogglePin,
  onDelete,
  onClose,
}) {
  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  return (
    <div className="flex h-full w-full flex-col border-r border-slate-200/80 bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <h2 className="text-sm font-semibold text-slate-900">Chat history</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat history"
          title="Close chat history"
          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <PanelLeftClose size={17} className="hidden xl:block" />
          <X size={17} className="xl:hidden" />
        </button>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <button
          type="button"
          onClick={onNewChat}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SquarePen size={16} />New chat
        </button>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/15">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          {search && (
            <button type="button" onClick={() => onSearchChange("")} aria-label="Clear search" className="text-slate-400 hover:text-slate-700"><X size={13} /></button>
          )}
        </label>
        {agentName && (
          <div role="tablist" aria-label="Which chats to show" className="grid grid-cols-2 rounded-xl bg-slate-100 p-0.5 text-xs font-medium">
            {[
              { value: "agent", label: agentName },
              { value: "all", label: "All chats" },
            ].map(({ value, label }) => (
              <button key={value} type="button" role="tab" aria-selected={scope === value} onClick={() => onScopeChange(value)} title={label} className={`truncate rounded-lg px-2 py-1.5 transition ${scope === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className={`min-h-0 flex-1 overflow-y-auto px-2 pb-3 ${hideScrollbar}`} aria-label="Chat history">
        {loading && !conversations.length && (
          <div className="space-y-2 px-1 pt-1">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}

        {!loading && !error && !conversations.length && (
          <p className="px-3 py-6 text-center text-xs leading-5 text-slate-500">
            {search
              ? "No chats match your search."
              : agentName && scope === "agent"
                ? `No chats with ${agentName} yet.`
                : "Your conversations will appear here."}
          </p>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((conversation) => (
                <ConversationItem
                  key={conversation.threadId}
                  conversation={conversation}
                  active={conversation.threadId === activeThreadId}
                  disabled={disabled}
                  onSelect={onSelect}
                  onRename={onRename}
                  onTogglePin={onTogglePin}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
