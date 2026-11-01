import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot, Coins, Ellipsis, MessageSquare, PanelLeftClose, Pencil, Pin,
  PinOff, Search, SquarePen, Trash2, Users, Workflow, X,
} from "lucide-react";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const hideScrollbar =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const menuContent =
  "rounded-2xl border border-white/10 bg-[#1d2026]/95 p-1.5 text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-xl";
const menuItem = "cursor-pointer gap-2.5 rounded-xl py-2 text-zinc-300 focus:bg-white/10 focus:text-white";

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
        className="w-full rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
        aria-label="Conversation title"
      />
    );
  }

  return (
    <div className={`group relative flex items-center rounded-xl transition-colors ${active ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(conversation.threadId)}
        title={conversation.title}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left disabled:cursor-not-allowed"
      >
        {conversation.agentId
          ? <Bot size={14} className="shrink-0 text-violet-300/80" />
          : <MessageSquare size={14} className="shrink-0 text-zinc-500" />}
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] ${active ? "text-white" : "text-zinc-300"}`}>{conversation.title}</span>
          {conversation.agentName && <span className="block truncate text-[11px] text-zinc-500">{conversation.agentName}</span>}
        </span>
        {conversation.hasPendingApproval && (
          <span className="size-2 shrink-0 rounded-full bg-amber-400" title="Waiting for your approval" />
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Conversation options"
          className={`mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-zinc-400 outline-none hover:bg-white/10 hover:text-white focus-visible:opacity-100 data-[popup-open]:opacity-100 ${active ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"}`}
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
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={() => onDelete(conversation)}
            className="cursor-pointer gap-2.5 rounded-xl py-2 text-red-400 focus:bg-red-500/10 focus:text-red-400"
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
  user,
}) {
  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  return (
    <div className="flex h-full w-full flex-col border-r border-white/10 bg-[#121317]/95 backdrop-blur-xl md:bg-black/20">
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-white text-zinc-900"><Workflow size={17} /></span>
          <span className="text-sm font-medium tracking-tight">AutoMate AI</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          title="Close sidebar"
          className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <PanelLeftClose size={17} className="hidden md:block" />
          <X size={17} className="md:hidden" />
        </button>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <button
          type="button"
          onClick={onNewChat}
          disabled={disabled}
          className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-zinc-200 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SquarePen size={16} />New chat
        </button>
        <Link
          to="/team"
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Users size={16} className="text-violet-300" />Agent teams
        </Link>
        <label className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 focus-within:border-white/20">
          <Search size={14} className="shrink-0 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-zinc-500"
          />
          {search && (
            <button type="button" onClick={() => onSearchChange("")} aria-label="Clear search" className="text-zinc-500 hover:text-white"><X size={13} /></button>
          )}
        </label>
      </div>

      <nav className={`min-h-0 flex-1 overflow-y-auto px-2 pb-3 ${hideScrollbar}`} aria-label="Chat history">
        {loading && !conversations.length && (
          <div className="space-y-2 px-1 pt-1">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        )}

        {error && <p className="px-3 py-2 text-xs text-red-300">{error}</p>}

        {!loading && !error && !conversations.length && (
          <p className="px-3 py-6 text-center text-xs leading-5 text-zinc-500">
            {search ? "No chats match your search." : "Your conversations will appear here."}
          </p>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{group.label}</p>
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

      <Link
        to="/pricing"
        className="m-3 flex shrink-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.07]"
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/10">
          {user?.profilePicture
            ? <img src={user.profilePicture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            : <Coins size={15} className="text-violet-300" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-zinc-200">{user?.name || "User"}</span>
          <span className="block text-[11px] text-zinc-500">
            {Number(user?.credits ?? 0).toLocaleString("en-IN")} credits
          </span>
        </span>
      </Link>
    </div>
  );
}
