import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUp, Bot, Check, ChevronDown, History, ImagePlus, MessageSquare,
  Plus, Settings, Users, Workflow, Trash2,
} from "lucide-react";

import { fetchAgentsApi } from "@/features/agents/agentApi";
import { sendMessageApi, agentChat, approveEmailApi } from "@/features/chat";
import {
  fetchConversationsApi, fetchConversationApi,
  updateConversationApi, deleteConversationApi,
} from "@/features/conversations";
import AppShell from "@/components/AppShell";
import ChatSidebar from "@/components/ChatSidebar";
import ApprovalCard from "@/components/ApprovalCard";
import { buildApproval, describeAutoApprovals, getInterrupt } from "@/lib/approvals";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "@/redux/userSlice";

const hideScrollbar =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const menuContent =
  "rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl shadow-slate-900/10";
const menuItem = "cursor-pointer gap-2 rounded-xl py-2 text-slate-700 focus:bg-slate-100 focus:text-slate-900";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const SIDEBAR_KEY = "automate.historyCollapsed";

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function normalizeAssistantReply(reply) {
  if (typeof reply === "string") return reply;
  if (reply == null) return "";
  try {
    return JSON.stringify(reply, null, 2);
  } catch {
    return String(reply);
  }
}

export default function Home() {
  const location = useLocation();
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const { user: currentUser } = useSelector((state) => state.auth);

  const [prompt, setPrompt] = useState("");
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [messages, setMessages] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [pendingApproval, setPendingApproval] = useState(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDescription, setImageDescription] = useState("");

  // Chat history sidebar
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [conversationLoading, setConversationLoading] = useState(false);
  const [readOnlyNotice, setReadOnlyNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed); // desktop
  const autoSelectedAgent = useRef(false);
  const latestSearch = useRef("");

  const loadConversations = useCallback(async (search = latestSearch.current) => {
    try {
      setConversationsError("");
      const list = await fetchConversationsApi(search.trim());
      // Ignore results from an older search that finished late
      if (search === latestSearch.current) setConversations(list);
    } catch (error) {
      setConversationsError(error?.response?.data?.message || "Failed to load chats.");
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  // Debounced search over chat titles
  useEffect(() => {
    latestSearch.current = historySearch;
    const timer = setTimeout(() => loadConversations(historySearch), 250);
    return () => clearTimeout(timer);
  }, [historySearch, loadConversations]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // Storage can be blocked (private mode); the toggle still works
    }
  }, [sidebarCollapsed]);

  const updateCredits = (remainingCredits) => {
    if (typeof remainingCredits === "number" && currentUser) {
      dispatch(setUser({ ...currentUser, credits: remainingCredits }));
    }
  };

  useEffect(() => {
    let active = true;
    const loadAgents = async () => {
      try {
        setLoading(true);
        setAgentsError("");
        const response = await fetchAgentsApi();
        const list = Array.isArray(response)
          ? response
          : response?.agents ?? response?.data?.agents ?? [];
        if (active) setAgents(list);
      } catch (error) {
        if (active) {
          setAgentsError(error?.response?.data?.message || "Failed to load agents.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAgents();
    return () => { active = false; };
  }, []);

  // Pick the first agent once on load; after that "no agent" (general chat)
  // is a valid choice, e.g. when reopening a general chat from history.
  useEffect(() => {
    if (agents.length && !autoSelectedAgent.current) {
      autoSelectedAgent.current = true;
      const requestedId = location.state?.selectedAgentId;
      const requested = agents.find((agent) => String(agent._id ?? agent.id) === String(requestedId));
      setSelectedAgent((current) => requested ?? current ?? agents[0]);
    }
  }, [agents, location.state?.selectedAgentId]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const clearSelectedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview("");
    setUploadedImage(null);
    setImageDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setChatError("");

    if (!file.type.startsWith("image/")) {
      setChatError("Please select a valid image file.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setChatError("Image must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadedImage(null);
  };

  // Uploads the selected image directly to Cloudinary using an unsigned upload preset.
  const uploadImageToCloudinary = async () => {
    if (uploadedImage?.secure_url) return uploadedImage;
    if (!selectedImage) return null;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error(
        "Cloudinary config missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in frontend .env."
      );
    }

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedImage);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", "automate-ai/instagram");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );
      const data = await response.json();

      if (!response.ok || !data?.secure_url) {
        throw new Error(data?.error?.message || "Cloudinary image upload failed.");
      }

      const image = {
        secure_url: data.secure_url,
        public_id: data.public_id,
        width: data.width,
        height: data.height,
        format: data.format,
      };
      setUploadedImage(image);
      return image;
    } finally {
      setImageUploading(false);
    }
  };

  const createApprovalFromResponse = (response, fallbackAgentId, fallbackThreadId) => {
    const approvalData = getInterrupt(response);
    if (!approvalData) return false;

    const built = buildApproval(approvalData, {
      agentId: fallbackAgentId,
      threadId: response?.threadId ?? fallbackThreadId,
    });
    if (!built) return false;

    setPendingApproval(built.approval);
    setMessages((previous) => [...previous, {
      role: "assistant",
      content: built.note,
    }]);
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const userPrompt = prompt.trim();
    if (
      (!userPrompt && !selectedImage) ||
      chatLoading || approvalLoading ||
      imageUploading || conversationLoading || pendingApproval || readOnlyNotice
    ) return;

    setChatError("");
    setChatLoading(true);

    try {
      let image = uploadedImage;
      if (selectedImage && !image?.secure_url) {
        image = await uploadImageToCloudinary();
      }

      // Attach the public image URL and description to the message so the agent/MCP tool
      // can use the actual Cloudinary URL. The URL alone does not describe image contents.
      let message = userPrompt || "Publish this image to my Instagram account.";
      if (image?.secure_url) {
        message += `\n\nImage URL: ${image.secure_url}`;
        message += `\nImage public ID: ${image.public_id || ""}`;
        if (imageDescription.trim()) {
          message += `\nImage description: ${imageDescription.trim()}`;
        }
        message += "\nIf I asked to publish this on Instagram, prepare a caption and request approval before publishing.";
      }

      // Show only what the user typed; the image metadata lines are for the agent
      setMessages((previous) => [...previous, {
        role: "user",
        content: userPrompt || (image?.secure_url ? "" : message),
        imageUrl: image?.secure_url || imagePreview || "",
      }]);
      setPrompt("");

      const agentId = selectedAgent?._id ?? selectedAgent?.id;
      const response = selectedAgent
        ? await agentChat({ message, threadId, agentId })
        : await sendMessageApi({ message, threadId });

      const resolvedThreadId = response?.threadId ?? threadId;
      if (resolvedThreadId) setThreadId(resolvedThreadId);
      updateCredits(response?.remainingCredits);
      loadConversations();

      if (
        (response?.requiresApproval || response?.interrupted) &&
        createApprovalFromResponse(response, agentId, resolvedThreadId)
      ) {
        clearSelectedImage();
        return;
      }

      setMessages((previous) => [
        ...previous,
        ...describeAutoApprovals(response?.autoApprovals).map((content) => ({ role: "assistant", content, kind: "auto" })),
        {
          role: "assistant",
          content: normalizeAssistantReply(response?.reply ?? response?.message ?? "Done."),
        },
      ]);
      clearSelectedImage();
    } catch (error) {
      setChatError(
        error?.response?.data?.message ||
        error?.message ||
        "Unable to complete the request. Please try again."
      );
    } finally {
      setChatLoading(false);
    }
  };
  // Uses the existing resume/approval endpoint for email, calendar and Instagram interrupts.
  // Backend must resume the same LangGraph thread with Command({ resume: { approved } }).
  const handleApproval = async (approved) => {
    if (!pendingApproval || approvalLoading) return;
    if (!pendingApproval.agentId || !pendingApproval.threadId) {
      setChatError("Approval details are missing. Please start a new conversation.");
      return;
    }

    setApprovalLoading(true);
    setChatError("");
    try {
      const response = await approveEmailApi({
        agentId: pendingApproval.agentId,
        threadId: pendingApproval.threadId,
        approved,
      });
      updateCredits(response?.remainingCredits);
      loadConversations();

      if (
        (response?.requiresApproval || response?.interrupted) &&
        createApprovalFromResponse(
          response,
          pendingApproval.agentId,
          response?.threadId ?? pendingApproval.threadId
        )
      ) {
        return;
      }

      setPendingApproval(null);
      setMessages((previous) => [...previous, {
        role: "assistant",
        content: normalizeAssistantReply(
          response?.reply ||
          (approved
            ? pendingApproval.type === "instagram"
              ? "Instagram publish workflow resumed. Verify the publish result above."
              : "Approval process complete. Verify the action status."
            : "Action reject kar di gayi hai.")
        ),
      }]);
    } catch (error) {
      setChatError(
        error?.response?.data?.message ||
        error?.message ||
        "Approval process failed. Please try again."
      );
    } finally {
      setApprovalLoading(false);
    }
  };

  // Pending approvals are saved on the server, so it's safe to leave a chat
  // that is waiting for approval and come back to it from the sidebar.
  const resetChat = () => {
    setMessages([]);
    setThreadId(null);
    setPendingApproval(null);
    setReadOnlyNotice("");
    setPrompt("");
    setChatError("");
    clearSelectedImage();
  };

  const handleNewChat = () => {
    if (chatLoading || approvalLoading || conversationLoading) return;
    resetChat();
    setSidebarOpen(false);
  };

  const handleSelectConversation = async (selectedThreadId) => {
    if (chatLoading || approvalLoading || conversationLoading) return;
    if (selectedThreadId === threadId) {
      setSidebarOpen(false);
      return;
    }

    setConversationLoading(true);
    setChatError("");
    try {
      const conversation = await fetchConversationApi(selectedThreadId);
      const agentId = conversation.agentId ? String(conversation.agentId) : null;
      const agent = agentId
        ? agents.find((item) => String(item._id ?? item.id) === agentId)
        : null;

      resetChat();
      autoSelectedAgent.current = true;
      setSelectedAgent(agent ?? null);
      setThreadId(conversation.threadId);
      setMessages(conversation.messages);

      if (conversation.agentDeleted) {
        setReadOnlyNotice(
          "The agent used in this chat was deleted. You can read it, but start a new chat to continue."
        );
      } else if (agentId && !agent) {
        setReadOnlyNotice("This chat's agent is inactive. Start a new chat to continue.");
      } else {
        // Bring back an approval card the user left without answering
        const restored = buildApproval(getInterrupt({ interrupts: conversation.pendingApproval }), {
          agentId,
          threadId: conversation.threadId,
        });
        if (restored) setPendingApproval(restored.approval);
      }

      setSidebarOpen(false);
    } catch (error) {
      setChatError(error?.response?.data?.message || "Failed to open this chat.");
    } finally {
      setConversationLoading(false);
    }
  };

  const handleRenameConversation = async (selectedThreadId, title) => {
    // Optimistic update so the new name shows instantly
    setConversations((previous) => previous.map((item) =>
      item.threadId === selectedThreadId ? { ...item, title } : item
    ));
    try {
      await updateConversationApi(selectedThreadId, { title });
    } catch (error) {
      setChatError(error?.response?.data?.message || "Failed to rename chat.");
      loadConversations();
    }
  };

  const handleTogglePin = async (conversation) => {
    try {
      await updateConversationApi(conversation.threadId, { pinned: !conversation.pinned });
      loadConversations();
    } catch (error) {
      setChatError(error?.response?.data?.message || "Failed to update chat.");
    }
  };

  const handleDeleteConversation = async (conversation) => {
    if (!window.confirm(`Delete "${conversation.title}"? This cannot be undone.`)) return;
    try {
      await deleteConversationApi(conversation.threadId);
      setConversations((previous) => previous.filter((item) => item.threadId !== conversation.threadId));
      if (conversation.threadId === threadId) resetChat();
    } catch (error) {
      setChatError(error?.response?.data?.message || "Failed to delete chat.");
    }
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    resetChat();
  };

  const firstName = currentUser?.name?.split(" ")[0] || "there";
  const isBusy = chatLoading || approvalLoading || imageUploading || conversationLoading;
  const inputLocked = isBusy || Boolean(pendingApproval) || Boolean(readOnlyNotice);
  const selectedAgentId = String(selectedAgent?._id ?? selectedAgent?.id ?? "");

  // History is an inline column on wide screens and a drawer below that
  const isWide = () => window.matchMedia("(min-width: 1280px)").matches;
  const toggleHistory = () => (isWide() ? setSidebarCollapsed((value) => !value) : setSidebarOpen(true));
  const closeHistory = () => (isWide() ? setSidebarCollapsed(true) : setSidebarOpen(false));

  const suggestions = selectedAgent
    ? ["Summarise my unread emails", "Schedule a 30 min meeting tomorrow at 4 PM", "What's on my calendar this week?"]
    : ["Explain LangGraph in simple words", "Write a polite leave application", "Give me 5 project viva questions"];

  return (
    <AppShell
      title={selectedAgent ? selectedAgent.name : "Chat"}
      subtitle={selectedAgent ? "Agent chat · real actions need your approval" : "General chat · no tools"}
      fullBleed
      actions={
        <button type="button" onClick={toggleHistory} title="Chat history" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50">
          <History size={15} /><span className="hidden sm:inline">History</span>
        </button>
      }
    >
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <button type="button" aria-label="Close chat history" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] xl:hidden" />
        )}

        <aside className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 max-xl:transition-transform max-xl:duration-200 xl:relative xl:z-auto xl:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? "xl:hidden" : ""}`}>
          <ChatSidebar
            conversations={conversations}
            loading={conversationsLoading}
            error={conversationsError}
            activeThreadId={threadId}
            disabled={chatLoading || approvalLoading || conversationLoading}
            search={historySearch}
            onSearchChange={setHistorySearch}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
            onRename={handleRenameConversation}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteConversation}
            onClose={closeHistory}
          />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
              {conversationLoading && (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading chat...</div>
              )}

              {!conversationLoading && messages.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center pb-6 text-center">
                  <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25"><Workflow size={26} /></div>
                  <p className="text-base font-medium text-indigo-600">Hi, {firstName}</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Can I help you with anything?</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">Ask questions, automate tasks, or upload an image to prepare an Instagram post.</p>
                  <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
                    {suggestions.map((suggestion) => (
                      <button key={suggestion} type="button" disabled={inputLocked} onClick={() => setPrompt(suggestion)} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-slate-900 disabled:opacity-50">
                        {suggestion}
                      </button>
                    ))}
                    <Link to="/team" className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-2 text-[13px] font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100">
                      <Users size={14} />Use an AI team for multi-step tasks
                    </Link>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && message.kind !== "auto" && (
                    <div className="mr-3 mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Workflow size={15} /></div>
                  )}
                  <div className={`max-w-[90%] break-words text-sm leading-7 sm:max-w-[80%] ${
                    message.role === "user"
                      ? "rounded-2xl rounded-br-md bg-indigo-600 px-4 py-3 text-white shadow-sm"
                      : message.kind === "auto"
                        ? "ml-11 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs leading-6 text-emerald-800"
                        : "rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 text-slate-800 shadow-sm"
                  }`}>
                    {message.imageUrl && <img src={message.imageUrl} alt="Attached image" className="mb-3 max-h-64 rounded-lg object-contain" />}
                    {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                  </div>
                </div>
              ))}

              {pendingApproval && (
                <ApprovalCard approval={pendingApproval} loading={approvalLoading} onDecision={handleApproval} />
              )}

              {chatLoading && (
                <div className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Workflow size={15} className="animate-pulse" /></div>
                  <div className="text-sm text-slate-500">{imageUploading ? "Uploading image..." : "AutoMate AI is thinking..."}</div>
                </div>
              )}
              {readOnlyNotice && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{readOnlyNotice}</div>}
              {(chatError || agentsError) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{chatError || agentsError}</div>}
            </div>
          </div>

          <div className="w-full shrink-0 px-3 pb-3 pt-2 sm:px-5 sm:pb-4">
            <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10">
              {imagePreview && (
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <img src={imagePreview} alt="Selected upload preview" className="size-20 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{selectedImage?.name}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{uploadedImage ? "Uploaded" : "Will upload when sent"}</p>
                    <input value={imageDescription} onChange={(e) => setImageDescription(e.target.value)} placeholder="Image description (optional)" className="mt-2 w-full border-b border-slate-200 bg-transparent py-1 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400" />
                  </div>
                  <button type="button" aria-label="Remove image" onClick={clearSelectedImage} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              )}
              <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }} placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : "Ask me anything..."} disabled={inputLocked} className={`min-h-16 resize-none border-0 !bg-transparent px-2 py-1.5 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-0 ${hideScrollbar}`} />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button type="button" aria-label="Attach image" title="Attach image" disabled={inputLocked} onClick={() => fileInputRef.current?.click()} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"><ImagePlus size={18} /></button>
                  <DropdownMenu>
                    <DropdownMenuTrigger disabled={isBusy} className="inline-flex h-9 max-w-52 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:opacity-50">
                      <Bot size={14} className="shrink-0 text-violet-600" /><span className="truncate">{loading ? "Loading agents..." : selectedAgent?.name || "General chat"}</span><ChevronDown size={13} className="shrink-0 text-slate-400" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className={`mb-2 w-64 ${menuContent}`}>
                      <DropdownMenuItem onClick={() => handleSelectAgent(null)} className={menuItem}><MessageSquare size={15} className="shrink-0 text-slate-400" /><span className="truncate">General chat (no tools)</span>{!selectedAgent && <Check size={14} className="ml-auto text-indigo-600" />}</DropdownMenuItem>
                      {!loading && !agents.length && <DropdownMenuItem disabled className={menuItem}>No agents yet</DropdownMenuItem>}
                      {agents.map((agent) => {
                        const id = String(agent._id ?? agent.id);
                        return <DropdownMenuItem key={id} onClick={() => handleSelectAgent(agent)} className={menuItem}><Bot size={15} className="shrink-0 text-violet-600" /><span className="truncate">{agent.name}</span>{selectedAgentId === id && <Check size={14} className="ml-auto text-indigo-600" />}</DropdownMenuItem>;
                      })}
                      <DropdownMenuSeparator className="bg-slate-100" />
                      <DropdownMenuItem asChild className={menuItem}><Link to="/agents/new"><Plus size={15} />Create new agent</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild className={menuItem}><Link to="/agents"><Settings size={15} />Manage agents</Link></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={isBusy} onClick={handleNewChat} className="h-9 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40">New chat</button>
                  <button type="submit" disabled={inputLocked || (!prompt.trim() && !selectedImage)} aria-label="Send message" className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"><ArrowUp size={17} /></button>
                </div>
              </div>
            </form>
            <p className="mx-auto mt-2.5 max-w-3xl text-center text-[11px] text-slate-400">AutoMate AI can make mistakes. Verify important information.</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
