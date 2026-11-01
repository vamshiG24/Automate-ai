import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUp, Bot, ChevronDown, Coins, ImagePlus, LogOut, MessageSquare,
  PanelLeftOpen, Plus, Settings, ShieldCheck, UserRound, Users, Workflow, Trash2,
} from "lucide-react";

import { fetchAgentsApi } from "@/features/agents/agentApi";
import { sendMessageApi, agentChat, approveEmailApi } from "@/features/chat";
import {
  fetchConversationsApi, fetchConversationApi,
  updateConversationApi, deleteConversationApi,
} from "@/features/conversations";
import { logoutApi, updateSettingsApi } from "@/features/auth.js";
import ChatSidebar from "@/components/ChatSidebar";
import ApprovalCard from "@/components/ApprovalCard";
import { buildApproval, describeAutoApprovals, getInterrupt } from "@/lib/approvals";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDispatch, useSelector } from "react-redux";
import { clearUser, setUser } from "@/redux/userSlice";

const hideScrollbar =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const darkPanel =
  "border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";
const menuContent =
  "rounded-2xl border border-white/10 bg-[#1d2026]/95 p-1.5 text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-xl";
const menuItem = "rounded-xl text-zinc-300 focus:bg-white/10 focus:text-white";
const menuSeparator = "bg-white/10";
const iconBtn =
  "size-9 rounded-xl border border-white/10 bg-white/[0.05] p-0 text-zinc-300 hover:bg-white/10 hover:text-white";
const whiteBtn =
  "rounded-xl border-0 bg-white text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const SIDEBAR_KEY = "automate.sidebarCollapsed";

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
  const navigate = useNavigate();
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
  const [logoutLoading, setLogoutLoading] = useState(false);
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
      setSelectedAgent((current) => current ?? agents[0]);
    }
  }, [agents]);

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
      chatLoading || approvalLoading || logoutLoading ||
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

  const handleToggleAutoApprove = async () => {
    const next = !currentUser?.autoApproveLowRisk;
    dispatch(setUser({ ...currentUser, autoApproveLowRisk: next }));
    try {
      await updateSettingsApi({ autoApproveLowRisk: next });
    } catch (error) {
      dispatch(setUser({ ...currentUser, autoApproveLowRisk: !next }));
      setChatError(error?.response?.data?.message || "Failed to update setting.");
    }
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    resetChat();
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    try {
      setLogoutLoading(true);
      setChatError("");
      await logoutApi();
      dispatch(clearUser());
      navigate("/login", { replace: true });
    } catch (error) {
      setChatError(error?.response?.data?.message || "Logout failed. Please try again.");
    } finally {
      setLogoutLoading(false);
    }
  };

  const firstName = currentUser?.name?.split(" ")[0] || "there";
  const isBusy = chatLoading || approvalLoading || logoutLoading || imageUploading || conversationLoading;
  const inputLocked = isBusy || Boolean(pendingApproval) || Boolean(readOnlyNotice);
  const selectedAgentId = String(selectedAgent?._id ?? selectedAgent?.id ?? "");

  const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;
  const openSidebar = () => (isDesktop() ? setSidebarCollapsed(false) : setSidebarOpen(true));
  const closeSidebar = () => (isDesktop() ? setSidebarCollapsed(true) : setSidebarOpen(false));

  return (
    <div className="relative flex h-dvh overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#2b2f3a_0%,#191b21_55%,#121317_100%)] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />

      {/* Mobile: dark backdrop behind the drawer */}
      {sidebarOpen && (
        <button type="button" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 max-md:transition-transform max-md:duration-200 md:relative md:z-20 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? "md:hidden" : ""}`}>
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
          onClose={closeSidebar}
          user={currentUser}
        />
      </aside>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Button type="button" variant="outline" aria-label="Open chat history" title="Chat history" onClick={openSidebar} className={`${iconBtn} ${sidebarCollapsed ? "" : "md:hidden"}`}><PanelLeftOpen size={16} /></Button>
            <Link to="/" className={`flex items-center gap-2.5 ${sidebarCollapsed ? "" : "md:hidden"}`}>
              <span className="grid size-8 place-items-center rounded-lg bg-white text-zinc-900"><Workflow size={17} /></span>
              <span className="hidden text-sm font-medium tracking-tight sm:inline">AutoMate AI</span>
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" aria-label="Open menu" className={iconBtn}><Workflow size={16} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={`w-56 ${menuContent}`}>
                <DropdownMenuItem asChild className={menuItem}><Link to="/agents" className="flex items-center gap-2.5 py-2.5"><Bot size={16} />My agents</Link></DropdownMenuItem>
                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem asChild className={menuItem}><Link to="/agents/new" className="flex items-center gap-2.5 py-2.5"><Plus size={16} />Create new agent</Link></DropdownMenuItem>
                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem asChild className={menuItem}><Link to="/team" className="flex items-center gap-2.5 py-2.5"><Users size={16} />Agent teams</Link></DropdownMenuItem>
                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem  className={`gap-2.5 py-2.5  ${menuItem}`}><Link to="/integrations" className="flex items-center gap-2.5 py-2.5"><Settings size={16} />Integrations </Link></DropdownMenuItem>
                <DropdownMenuSeparator className={menuSeparator} />
<DropdownMenuItem asChild className={menuItem}>
  <Link to="/pricing" className="flex items-center gap-2.5 py-2.5">
    <Coins size={16} />
    Pricing
  </Link>
</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Open profile menu" className="flex size-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.05]">
                  {currentUser?.profilePicture ? <img src={currentUser.profilePicture} alt="Profile" referrerPolicy="no-referrer" className="size-full object-cover" /> : <UserRound size={17} className="text-zinc-300" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={`w-64 ${menuContent}`}>
                <DropdownMenuItem asChild className={`${menuItem} cursor-pointer`}>
  <Link
    to="/pricing"
    className="flex items-center justify-between gap-3 py-2.5"
  >
    <span className="flex items-center gap-2.5">
      <Coins size={16} className="text-violet-300" />
      <span className="text-sm">Credits</span>
    </span>
 
    <span className="flex items-center gap-2">
      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white">
        {Number(currentUser?.credits ?? 0).toLocaleString("en-IN")}
      </span>
      <span className="text-[11px] text-zinc-500">Buy more</span>
    </span>
  </Link>
</DropdownMenuItem>
<DropdownMenuSeparator className={menuSeparator} />
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{currentUser?.name || "User"}</p><p className="truncate text-xs text-zinc-500">{currentUser?.email || ""}</p></div>
                </div>
                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem closeOnClick={false} onClick={handleToggleAutoApprove} className={`cursor-pointer gap-2.5 py-2.5 ${menuItem}`}>
                  <ShieldCheck size={16} className="shrink-0 text-emerald-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">Auto-approve low risk</span>
                    <span className="block text-[11px] text-zinc-500">Skip the card for safe, familiar actions</span>
                  </span>
                  <span role="switch" aria-checked={Boolean(currentUser?.autoApproveLowRisk)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${currentUser?.autoApproveLowRisk ? "bg-emerald-400" : "bg-white/15"}`}>
                    <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${currentUser?.autoApproveLowRisk ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem onClick={(event) => { event.preventDefault(); handleLogout(); }} disabled={logoutLoading} className="cursor-pointer gap-2.5 rounded-xl py-2.5 text-red-400 focus:bg-red-500/10 focus:text-red-400"><LogOut size={16} />{logoutLoading ? "Logging out..." : "Logout"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <section className="flex min-h-0 flex-1 flex-col">
            <div className={`min-h-0 flex-1 overflow-y-auto ${hideScrollbar}`}>
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
                {conversationLoading && (
                  <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">Loading chat...</div>
                )}

                {!conversationLoading && messages.length === 0 && (
                  <div className="flex flex-1 flex-col items-center justify-center pb-8 text-center">
                    <div className="mb-7 grid size-14 place-items-center rounded-2xl bg-white text-zinc-900"><Workflow size={26} /></div>
                    <p className="text-base text-violet-300/80">Hi, {firstName}</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Can I help you with anything?</h1>
                    <p className="mt-4 max-w-sm text-xs leading-5 text-zinc-500">Ask questions, automate tasks, or upload an image to prepare an Instagram post.</p>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && <div className="mr-3 mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-white text-zinc-900"><Workflow size={15} /></div>}
                    <div className={`max-w-[90%] break-words px-4 py-3 text-sm leading-7 sm:max-w-[80%] ${message.role === "user" ? `rounded-2xl rounded-br-md text-white ${darkPanel}` : message.kind === "auto" ? "rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] text-xs leading-6 text-emerald-200" : "text-zinc-200"}`}>
                      {message.imageUrl && <img src={message.imageUrl} alt="Attached image" className="mb-3 max-h-64 rounded-lg object-contain" />}
                      {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                    </div>
                  </div>
                ))}

                {pendingApproval && (
                  <ApprovalCard approval={pendingApproval} loading={approvalLoading} onDecision={handleApproval} />
                )}

                {chatLoading && <div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-lg bg-white text-zinc-900"><Workflow size={15} className="animate-pulse" /></div><div className="text-sm text-zinc-400">{imageUploading ? "Uploading image to Cloudinary..." : "AutoMate AI is thinking..."}</div></div>}
                {readOnlyNotice && <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-200">{readOnlyNotice}</div>}
                {(chatError || agentsError) && <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300">{chatError || agentsError}</div>}
              </div>
            </div>

            <div className="z-20 w-full shrink-0 px-3 pb-3 pt-2 sm:px-5 sm:pb-4">
              <form onSubmit={handleSubmit} className={`mx-auto w-full max-w-2xl rounded-2xl p-3 transition-colors focus-within:border-white/25 ${darkPanel}`}>
                {imagePreview && (
                  <div className="mb-3 flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5">
                    <img src={imagePreview} alt="Selected upload preview" className="size-20 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-zinc-300">{selectedImage?.name}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">{uploadedImage ? "Uploaded to Cloudinary" : "Will upload to Cloudinary when sent"}</p>
                      <input value={imageDescription} onChange={(e) => setImageDescription(e.target.value)} placeholder="Image description (optional)" className="mt-2 w-full border-b border-white/10 bg-transparent py-1 text-xs text-white outline-none placeholder:text-zinc-500" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove image" onClick={clearSelectedImage} className="size-8 text-zinc-400 hover:text-red-400"><Trash2 size={15} /></Button>
                  </div>
                )}
                <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }} placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : "Ask me anything..."} disabled={inputLocked} className={`min-h-20 resize-none border-0 !bg-transparent px-2 py-1.5 text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0 ${hideScrollbar}`} />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Button type="button" variant="ghost" aria-label="Attach image" title="Attach image" disabled={inputLocked} onClick={() => fileInputRef.current?.click()} className="size-8 rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white"><ImagePlus size={17} /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button type="button" variant="ghost" disabled={isBusy} className="h-8 max-w-48 gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white"><Bot size={14} className="shrink-0" /><span className="truncate">{loading ? "Loading agents..." : selectedAgent?.name || "General chat"}</span><ChevronDown size={12} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="top" className={`mb-2 w-60 ${menuContent}`}>
                        {loading && <DropdownMenuItem disabled className={menuItem}>Loading agents...</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => handleSelectAgent(null)} className={`cursor-pointer gap-2 ${menuItem}`}><MessageSquare size={15} className="shrink-0 text-zinc-400" /><span className="truncate">General chat (no tools)</span>{!selectedAgent && <span className="ml-auto text-xs text-violet-300">✓</span>}</DropdownMenuItem>
                        {!loading && !agents.length && <DropdownMenuItem disabled className={menuItem}>No agents found</DropdownMenuItem>}
                        {agents.map((agent) => {
                          const id = String(agent._id ?? agent.id);
                          return <DropdownMenuItem key={id} onClick={() => handleSelectAgent(agent)} className={`cursor-pointer gap-2 ${menuItem}`}><Bot size={15} className="shrink-0 text-violet-300" /><span className="truncate">{agent.name}</span>{selectedAgentId === id && <span className="ml-auto text-xs text-violet-300">✓</span>}</DropdownMenuItem>;
                        })}
                        <DropdownMenuSeparator className={menuSeparator} />
                        <DropdownMenuItem asChild className={menuItem}><Link to="/agents/new" className="flex items-center gap-2"><Plus size={15} />Create new agent</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild className={menuItem}><Link to="/agents" className="flex items-center gap-2"><Settings size={15} />Manage agents</Link></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" disabled={isBusy} onClick={handleNewChat} className="h-8 rounded-lg px-3 text-xs text-zinc-400 hover:bg-white/10 hover:text-white">New chat</Button>
                    <Button type="submit" size="icon" disabled={inputLocked || (!prompt.trim() && !selectedImage)} aria-label="Send message" className={`size-8 shrink-0 ${whiteBtn} disabled:bg-white/10 disabled:text-zinc-500`}><ArrowUp size={16} /></Button>
                  </div>
                </div>
              </form>
              <p className="mx-auto mt-3 max-w-2xl text-center text-[10px] text-zinc-600">AutoMate AI can make mistakes. Verify important information.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
