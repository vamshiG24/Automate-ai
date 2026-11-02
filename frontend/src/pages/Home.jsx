import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUp, Bot, Check, ChevronDown, History, ImagePlus, MessageSquare,
  Plus, Settings, Users, Workflow, Trash2, Route, ListOrdered, Building2, X, ChevronRight,
} from "lucide-react";
import LiveOffice from "@/components/office/LiveOffice";
import { describeStep } from "@/components/office/status";
import { seatColor } from "@/components/office/layout";
import { approveTeamActionStream, sendTeamMessageStream } from "@/features/teamChat";

import { fetchAgentsApi, updateAgentApi } from "@/features/agents/agentApi";
import { sendMessageApi, agentChat, approveEmailApi } from "@/features/chat";
import {
  fetchConversationsApi, fetchConversationApi,
  updateConversationApi, deleteConversationApi,
} from "@/features/conversations";
import AppShell from "@/components/AppShell";
import ChatSidebar from "@/components/ChatSidebar";
import Markdown from "@/components/Markdown";
import ApprovalCard from "@/components/ApprovalCard";
import { buildApproval, describeAutoApprovals, getInterrupt } from "@/lib/approvals";
import { alertApprovalNeeded } from "@/lib/alerts";
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

// "5 min ago", "Yesterday", "12 Oct"
function timeAgo(date) {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  if (minutes < 48 * 60) return "Yesterday";
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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
  const messagesEndRef = useRef(null);
  const promptRef = useRef(null);
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

  // Agent team chat: live status of each member (drives the office animation)
  const [memberStatus, setMemberStatus] = useState({});
  const [teamActivity, setTeamActivity] = useState("");
  const [officeOpen, setOfficeOpen] = useState(false);
  // Sidebar shows only the selected agent's chats, or every chat
  const [historyScope, setHistoryScope] = useState("agent");

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
    alertApprovalNeeded({
      title: "AutoMate AI needs your approval",
      body: built.approval.risk
        ? `${built.approval.risk.level === "high" ? "High-risk" : "An"} action is waiting in your chat.`
        : "An action is waiting in your chat.",
    });
    return true;
  };

  // Keep the newest message, approval card or "working" line in view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, pendingApproval, chatLoading, teamActivity]);

  // Esc closes the office panel
  useEffect(() => {
    if (!officeOpen) return;
    const onKey = (event) => event.key === "Escape" && setOfficeOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [officeOpen]);

  // Live events from the team stream -> office animation + chat bubbles
  const handleTeamEvent = (agentId) => {
    let activeThreadId = threadId;
    const setStatus = (memberId, status) => setMemberStatus((previous) => ({ ...previous, [memberId]: status }));

    return (event, data) => {
      if (event === "start") {
        activeThreadId = data.threadId;
        setThreadId(data.threadId);
      } else if (event === "thinking") {
        setTeamActivity("Coordinator is choosing who should work on this…");
      } else if (event === "route") {
        setTeamActivity(`Coordinator → ${data.steps.map((step) => step.memberName).join(" → ")}`);
        setMemberStatus(Object.fromEntries(data.steps.map((step) => [step.memberId, "pending"])));
      } else if (event === "member_start") {
        setStatus(data.memberId, "running");
        setTeamActivity(`${data.memberName} is working…`);
      } else if (event === "member_done") {
        setStatus(data.memberId, "completed");
        setMessages((previous) => [...previous, { role: "assistant", content: data.content, memberId: data.memberId, memberName: data.memberName }]);
        updateCredits(data.remainingCredits);
      } else if (event === "message") {
        setMessages((previous) => [...previous, data]);
      } else if (event === "member_error") {
        setStatus(data.memberId, "failed");
        setMessages((previous) => [...previous, { role: "assistant", kind: "error", memberId: data.memberId, memberName: data.memberName, content: `${data.memberName} couldn't finish: ${data.message}` }]);
      } else if (event === "approval") {
        setStatus(data.memberId, "waiting_approval");
        const built = buildApproval(getInterrupt({ interrupts: data.interrupts }), {
          agentId, threadId: activeThreadId, team: true, memberName: data.memberName,
        });
        if (built) {
          setPendingApproval(built.approval);
          alertApprovalNeeded({ title: `${data.memberName} needs your approval`, body: "An action from your agent team is waiting in chat." });
        }
      } else if (event === "error") {
        setChatError(data.message);
      } else if (event === "done") {
        setTeamActivity("");
      }
    };
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
      // Only agents allowed to post get Instagram wording; everyone else
      // treats an image without text as "describe this".
      const canPostInstagram = Boolean(selectedAgent?.tools?.includes("post.instagram"));
      let message = userPrompt || (canPostInstagram
        ? "Publish this image to my Instagram account."
        : "What is in this image? Describe it.");
      if (image?.secure_url) {
        message += `\n\nImage URL: ${image.secure_url}`;
        message += `\nImage public ID: ${image.public_id || ""}`;
        if (imageDescription.trim()) {
          message += `\nImage description: ${imageDescription.trim()}`;
        }
        if (canPostInstagram) {
          message += "\nIf I asked to publish this on Instagram, prepare a caption and request approval before publishing.";
        }
      }

      // Show only what the user typed; the image metadata lines are for the agent
      setMessages((previous) => [...previous, {
        role: "user",
        content: userPrompt || (image?.secure_url ? "" : message),
        imageUrl: image?.secure_url || imagePreview || "",
      }]);
      setPrompt("");

      const agentId = selectedAgent?._id ?? selectedAgent?.id;

      if (selectedAgent?.kind === "team") {
        await sendTeamMessageStream({ agentId, message, threadId }, handleTeamEvent(agentId));
        loadConversations();
        clearSelectedImage();
        return;
      }

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

    if (pendingApproval.team) {
      const approval = pendingApproval;
      setPendingApproval(null);
      try {
        await approveTeamActionStream({ agentId: approval.agentId, threadId: approval.threadId, approved }, handleTeamEvent(approval.agentId));
        loadConversations();
      } catch (error) {
        setChatError(error?.message || "Approval process failed. Please try again.");
        setPendingApproval(approval);
      } finally {
        setApprovalLoading(false);
      }
      return;
    }

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
    setMemberStatus({});
    setTeamActivity("");
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
        const isTeamChat = conversation.kind === "team";
        const pendingMember = agent?.members?.find((member) => member.memberId === conversation.pendingMemberId);
        const restored = buildApproval(getInterrupt({ interrupts: conversation.pendingApproval }), {
          agentId,
          threadId: conversation.threadId,
          ...(isTeamChat ? { team: true, memberName: pendingMember?.name } : {}),
        });
        if (restored) setPendingApproval(restored.approval);
        if (restored && pendingMember) setMemberStatus({ [pendingMember.memberId]: "waiting_approval" });
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

  const isTeam = selectedAgent?.kind === "team";

  // Earlier chats with the selected agent or team
  const agentConversations = selectedAgent
    ? conversations.filter((conversation) => String(conversation.agentId ?? "") === selectedAgentId)
    : [];
  const sidebarConversations = selectedAgent && historyScope === "agent" ? agentConversations : conversations;

  const openAgentHistory = () => {
    setHistoryScope("agent");
    if (isWide()) setSidebarCollapsed(false);
    else setSidebarOpen(true);
  };

  const suggestions = isTeam
    ? ["What can each of you do?", "Summarise my unread emails", "Draft a reply to my latest email"]
    : selectedAgent
      ? ["Summarise my unread emails", "Schedule a 30 min meeting tomorrow at 4 PM", "What's on my calendar this week?"]
      : ["Explain LangGraph in simple words", "Write a polite leave application", "Give me 5 project viva questions"];

  // Office: each member at a desk; idle members show "Ready"
  const officeSteps = isTeam
    ? selectedAgent.members.map((member) => ({
        stepId: member.memberId,
        agentName: member.name,
        status: memberStatus[member.memberId] || "idle",
        capabilities: member.tools || [],
        dependsOn: [],
      }))
    : [];
  const workingMember = officeSteps.find((step) => step.status === "running");
  const nextMember = officeSteps.find((step) => step.status === "pending");
  const busyText = nextMember
    ? `Live · handing off to ${nextMember.agentName}`
    : officeSteps.some((step) => step.status === "completed")
      ? "Live · wrapping up"
      : "Live · coordinator is choosing";
  const officeHeadline = officeSteps.some((step) => step.status === "waiting_approval")
    ? { live: true, text: "Live · waiting for your approval" }
    : workingMember
      ? { live: true, text: `Live · ${workingMember.agentName} is working` }
      : (chatLoading || approvalLoading) && isTeam
        ? { live: true, text: busyText }
        : { live: false, text: `${selectedAgent?.name} · ${officeSteps.length} members ready` };
  const describeMember = (step) =>
    step.status === "idle" ? "Ready" : step.status === "pending" ? "Up next" : describeStep(step, officeSteps, "running");
  const memberColor = (memberId) => {
    const index = selectedAgent?.members?.findIndex((member) => member.memberId === memberId) ?? -1;
    return index >= 0 ? seatColor(index) : "#6366f1";
  };


  // Switch how the team works; saved on the team so it sticks
  const handleTeamMode = async (mode) => {
    if (!isTeam || (selectedAgent.teamMode || "route") === mode) return;
    const id = selectedAgent._id ?? selectedAgent.id;
    const previous = selectedAgent;
    const swap = (agent) => setAgents((list) => list.map((item) => ((item._id ?? item.id) === id ? agent : item)));

    setSelectedAgent({ ...previous, teamMode: mode });
    swap({ ...previous, teamMode: mode });
    try {
      await updateAgentApi(id, { teamMode: mode });
    } catch (error) {
      setSelectedAgent(previous);
      swap(previous);
      setChatError(error?.response?.data?.message || "Could not change the team mode.");
    }
  };

  // Clicking a member starts a message addressed only to them
  const mentionMember = (name) => {
    if (inputLocked) return;
    // Replace any existing leading @mentions of team members (and nothing else)
    const names = selectedAgent.members
      .map((member) => member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const leadingMentions = new RegExp(`^(@(${names})[\\s,:]*)+`, "i");
    setPrompt((current) => `@${name} ${current.replace(leadingMentions, "")}`);
    promptRef.current?.focus();
  };

  const teamMode = selectedAgent?.teamMode || "route";
  const statusDot = (status) =>
    status === "running" ? "animate-pulse bg-violet-500"
      : status === "waiting_approval" ? "bg-amber-500"
        : status === "completed" ? "bg-emerald-500"
          : status === "failed" ? "bg-red-500"
            : status === "pending" ? "bg-sky-400" : "bg-slate-300";

  const modeSwitch = (
    <div role="radiogroup" aria-label="How the team works" className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-medium">
      {[
        { value: "route", label: "Smart routing", Icon: Route, hint: "The coordinator picks only the members a message needs" },
        { value: "pipeline", label: "Full pipeline", Icon: ListOrdered, hint: "Every message goes through all members in order" },
      ].map(({ value, label, Icon, hint }) => (
        <button key={value} type="button" role="radio" aria-checked={teamMode === value} title={hint} disabled={isBusy} onClick={() => handleTeamMode(value)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition ${teamMode === value ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
          <Icon size={12} />{label}
        </button>
      ))}
    </div>
  );

  return (
    <AppShell
      title={selectedAgent ? selectedAgent.name : "Chat"}
      subtitle={isTeam
        ? `Agent team · ${selectedAgent.members.length} members · ${(selectedAgent.teamMode || "route") === "pipeline" ? "every message goes through all members" : "a coordinator routes each message"}`
        : selectedAgent ? "Agent chat · real actions need your approval" : "General chat · no tools"}
      fullBleed
      actions={
        <>
          <button type="button" onClick={toggleHistory} title="Chat history" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50">
            <History size={15} /><span className="hidden sm:inline">History</span>
          </button>
          {isTeam && (
            <button type="button" onClick={() => setOfficeOpen(true)} title="Open the team office" className="relative inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100">
              <Building2 size={15} /><span className="hidden sm:inline">Office</span>
              {officeHeadline.live && <span className="absolute -right-1 -top-1 size-2.5 animate-pulse rounded-full bg-red-500 ring-2 ring-white" aria-label="Team is working" />}
            </button>
          )}
        </>
      }
    >
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <button type="button" aria-label="Close chat history" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] xl:hidden" />
        )}

        <aside className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 max-xl:transition-transform max-xl:duration-200 xl:relative xl:z-auto xl:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? "xl:hidden" : ""}`}>
          <ChatSidebar
            conversations={sidebarConversations}
            agentName={selectedAgent?.name}
            scope={historyScope}
            onScopeChange={setHistoryScope}
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
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                    {isTeam
                      ? <>Type <span className="font-medium text-slate-700">@{selectedAgent.members[0]?.name}</span> to ask one member. Open <span className="font-medium text-slate-700">Office</span> to watch the team or switch Smart routing / Full pipeline.</>
                      : "Ask questions, automate tasks, or attach an image and ask about it."}
                  </p>
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

                  {agentConversations.length > 0 && (
                    <div className="mt-8 w-full max-w-xl text-left">
                      <div className="mb-2 flex items-center justify-between px-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Previous chats with {selectedAgent.name}</p>
                        {agentConversations.length > 4 && (
                          <button type="button" onClick={openAgentHistory} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">See all {agentConversations.length}</button>
                        )}
                      </div>
                      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        {agentConversations.slice(0, 4).map((conversation) => (
                          <button key={conversation.threadId} type="button" disabled={isBusy} onClick={() => handleSelectConversation(conversation.threadId)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-50">
                            {isTeam ? <Users size={15} className="shrink-0 text-rose-500" /> : <Bot size={15} className="shrink-0 text-violet-500" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">{conversation.title}</span>
                              {conversation.lastMessage && <span className="block truncate text-xs text-slate-500">{conversation.lastMessage}</span>}
                            </span>
                            {conversation.hasPendingApproval && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">Needs approval</span>}
                            <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(conversation.updatedAt)}</span>
                            <ChevronRight size={15} className="shrink-0 text-slate-300" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && message.kind !== "auto" && (
                    message.memberName
                      ? <div className="mr-3 mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold text-white shadow-sm" style={{ backgroundColor: memberColor(message.memberId) }} title={message.memberName}>{message.memberName.slice(0, 1).toUpperCase()}</div>
                      : <div className="mr-3 mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Workflow size={15} /></div>
                  )}
                  <div className={`max-w-[90%] break-words text-sm leading-7 sm:max-w-[80%] ${
                    message.role === "user"
                      ? "rounded-2xl rounded-br-md bg-indigo-600 px-4 py-3 text-white shadow-sm"
                      : message.kind === "auto"
                        ? "ml-11 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs leading-6 text-emerald-800"
                        : message.kind === "error"
                          ? "rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-4 py-3 text-red-800"
                          : "rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 text-slate-800 shadow-sm"
                  }`}>
                    {message.memberName && message.kind !== "auto" && (
                      <p className="mb-1 text-xs font-semibold" style={{ color: memberColor(message.memberId) }}>{message.memberName}</p>
                    )}
                    {message.imageUrl && <img src={message.imageUrl} alt="Attached image" className="mb-3 max-h-64 rounded-lg object-contain" />}
                    {message.content && (
                      message.role === "assistant" && message.kind !== "auto"
                        ? <Markdown>{message.content}</Markdown>
                        : <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {pendingApproval && (
                <div className="space-y-2">
                  {pendingApproval.memberName && (
                    <p className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: memberColor(selectedAgent?.members?.find((member) => member.name === pendingApproval.memberName)?.memberId) }} />
                      {pendingApproval.memberName} wants to do this:
                    </p>
                  )}
                  <ApprovalCard approval={pendingApproval} loading={approvalLoading} onDecision={handleApproval} />
                </div>
              )}

              {chatLoading && (
                <div className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Workflow size={15} className="animate-pulse" /></div>
                  <div className="text-sm text-slate-500">{imageUploading ? "Uploading image..." : isTeam ? (teamActivity || "Your team is starting…") : "AutoMate AI is thinking..."}</div>
                </div>
              )}
              {readOnlyNotice && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{readOnlyNotice}</div>}
              {(chatError || agentsError) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{chatError || agentsError}</div>}
              <div ref={messagesEndRef} aria-hidden />
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
              }} ref={promptRef} placeholder={isTeam ? `Message ${selectedAgent.name}… (or @${selectedAgent.members[0]?.name} to ask one member)` : selectedAgent ? `Message ${selectedAgent.name}...` : "Ask me anything..."} disabled={inputLocked} className={`min-h-16 resize-none border-0 !bg-transparent px-2 py-1.5 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-0 ${hideScrollbar}`} />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button type="button" aria-label="Attach image" title="Attach image" disabled={inputLocked} onClick={() => fileInputRef.current?.click()} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"><ImagePlus size={18} /></button>
                  <DropdownMenu>
                    <DropdownMenuTrigger disabled={isBusy} className="inline-flex h-9 max-w-52 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:opacity-50">
                      {isTeam ? <Users size={14} className="shrink-0 text-rose-500" /> : <Bot size={14} className="shrink-0 text-violet-600" />}<span className="truncate">{loading ? "Loading agents..." : selectedAgent?.name || "General chat"}</span><ChevronDown size={13} className="shrink-0 text-slate-400" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className={`mb-2 w-64 ${menuContent}`}>
                      <DropdownMenuItem onClick={() => handleSelectAgent(null)} className={menuItem}><MessageSquare size={15} className="shrink-0 text-slate-400" /><span className="truncate">General chat (no tools)</span>{!selectedAgent && <Check size={14} className="ml-auto text-indigo-600" />}</DropdownMenuItem>
                      {!loading && !agents.length && <DropdownMenuItem disabled className={menuItem}>No agents yet</DropdownMenuItem>}
                      {agents.map((agent) => {
                        const id = String(agent._id ?? agent.id);
                        return <DropdownMenuItem key={id} onClick={() => handleSelectAgent(agent)} className={menuItem}>{agent.kind === "team" ? <Users size={15} className="shrink-0 text-rose-500" /> : <Bot size={15} className="shrink-0 text-violet-600" />}<span className="truncate">{agent.name}</span>{agent.kind === "team" && <span className="rounded-full bg-rose-50 px-1.5 text-[10px] font-medium text-rose-600">team</span>}{selectedAgentId === id && <Check size={14} className="ml-auto text-indigo-600" />}</DropdownMenuItem>;
                      })}
                      <DropdownMenuSeparator className="bg-slate-100" />
                      <DropdownMenuItem asChild className={menuItem}><Link to="/agents/new"><Plus size={15} />Create new agent</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild className={menuItem}><Link to="/agents/new?type=team"><Users size={15} />Create agent team</Link></DropdownMenuItem>
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

        {/* Team office: opens over the chat from the "Office" button and stays live */}
        {isTeam && officeOpen && (
          <>
            <button type="button" aria-label="Close office" onClick={() => setOfficeOpen(false)} className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]" />
            <aside role="dialog" aria-label={`${selectedAgent.name} office`} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col bg-[#f5f6fa] shadow-2xl shadow-slate-900/20">
              <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-5">
                <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Building2 size={18} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-semibold text-slate-900">{selectedAgent.name} office</h2>
                  <p className="truncate text-xs text-slate-500">Watch your team work live. Your chat keeps running behind this panel.</p>
                </div>
                <button type="button" onClick={() => setOfficeOpen(false)} aria-label="Close office" title="Close (Esc)" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <LiveOffice steps={officeSteps} runStatus="running" headline={officeHeadline} describe={describeMember} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">How the team works</p>
                    <p className="text-xs text-slate-500">{teamMode === "pipeline" ? "Every message goes through all members in order." : "The coordinator picks only the members a message needs."}</p>
                  </div>
                  {modeSwitch}
                </div>

                <ul className="grid gap-2 sm:grid-cols-2">
                  {officeSteps.map((step) => {
                    const member = selectedAgent.members.find((item) => item.memberId === step.stepId);
                    return (
                      <li key={step.stepId}>
                        <button type="button" disabled={inputLocked} onClick={() => { mentionMember(step.agentName); setOfficeOpen(false); }} title={`Ask only ${step.agentName}`} className="flex h-full w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-indigo-300 disabled:opacity-60">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: memberColor(step.stepId) }}>{step.agentName.slice(0, 1).toUpperCase()}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-900">{step.agentName}</span>
                              <span className={`size-2 shrink-0 rounded-full ${statusDot(step.status)}`} />
                              <span className="truncate text-[11px] text-slate-500">{describeMember(step)}</span>
                            </span>
                            {member?.role && <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">{member.role}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-center text-[11px] text-slate-400">Click a member to ask only them.</p>
              </div>
            </aside>
          </>
        )}
      </div>
    </AppShell>
  );
}
