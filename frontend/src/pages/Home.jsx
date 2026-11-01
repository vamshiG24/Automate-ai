import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUp, Bot, CalendarDays, Check, ChevronDown, Clock, Coins, ImagePlus,
  LogOut, Mail, Plus, Settings, UserRound, Workflow, X, Trash2,
} from "lucide-react";

import { fetchAgentsApi } from "@/features/agents/agentApi";
import { sendMessageApi, agentChat, approveEmailApi } from "@/features/chat";
import { logoutApi } from "@/features/auth.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDispatch, useSelector } from "react-redux";
import { clearUser } from "@/redux/userSlice";

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

function getInterrupt(response) {
  const item = response?.interrupts?.[0];
  return item?.value ?? item;
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

  useEffect(() => {
    if (agents.length && !selectedAgent) setSelectedAgent(agents[0]);
  }, [agents, selectedAgent]);

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

    const common = {
      agentId: fallbackAgentId,
      threadId: response?.threadId ?? fallbackThreadId,
    };

    if (approvalData.type === "email_approval" && approvalData.email) {
      setPendingApproval({
        ...common,
        type: "email",
        email: {
          to: approvalData.email.to ?? "",
          subject: approvalData.email.subject ?? "",
          body: approvalData.email.body ?? "",
        },
      });
      setMessages((previous) => [...previous, {
        role: "assistant",
        content: "Email bhejne se pehle details review karein aur approval dein.",
      }]);
      return true;
    }

    if (approvalData.type === "calendar_approval" && approvalData.event) {
      setPendingApproval({
        ...common,
        type: "calendar",
        event: {
          summary: approvalData.event.summary ?? "",
          description: approvalData.event.description ?? "",
          startDateTime: approvalData.event.startDateTime ?? "",
          endDateTime: approvalData.event.endDateTime ?? "",
          timeZone: approvalData.event.timeZone ?? "Asia/Kolkata",
        },
      });
      setMessages((previous) => [...previous, {
        role: "assistant",
        content: "Calendar event create karne se pehle details review karein aur approval dein.",
      }]);
      return true;
    }

    // Expected interrupt payload from LangGraph:
    // { type: "instagram_publish_approval", imageUrl, caption, topic, imageDescription, hashtags }
    if (
      ["instagram_publish_approval", "instagram_approval", "publish_instagram_image_approval"]
        .includes(approvalData.type)
    ) {
      setPendingApproval({
        ...common,
        type: "instagram",
        imageUrl: approvalData.imageUrl ?? approvalData.image_url ?? "",
        caption: approvalData.caption ?? "",
        topic: approvalData.topic ?? "",
        imageDescription: approvalData.imageDescription ?? "",
        hashtags: Array.isArray(approvalData.hashtags)
          ? approvalData.hashtags
          : [],
      });
      setMessages((previous) => [...previous, {
        role: "assistant",
        content: "Instagram par publish karne se pehle image aur caption review karein.",
      }]);
      return true;
    }
    return false;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const userPrompt = prompt.trim();
    if (
      (!userPrompt && !selectedImage) ||
      chatLoading || approvalLoading || logoutLoading ||
      imageUploading || pendingApproval
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

      setMessages((previous) => [...previous, {
        role: "user",
        content: message,
        imageUrl: image?.secure_url || imagePreview || "",
      }]);
      setPrompt("");

      const agentId = selectedAgent?._id ?? selectedAgent?.id;
      const response = selectedAgent
        ? await agentChat({ message, threadId, agentId })
        : await sendMessageApi({ message, threadId });

      const resolvedThreadId = response?.threadId ?? threadId;
      if (resolvedThreadId) setThreadId(resolvedThreadId);

      if (
        (response?.requiresApproval || response?.interrupted) &&
        createApprovalFromResponse(response, agentId, resolvedThreadId)
      ) {
        clearSelectedImage();
        return;
      }

      setMessages((previous) => [...previous, {
        role: "assistant",
        content: normalizeAssistantReply(response?.reply ?? response?.message ?? "Done."),
      }]);
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
console.log(currentUser)
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

  const handleNewChat = () => {
    if (chatLoading || approvalLoading || pendingApproval) return;
    setMessages([]);
    setThreadId(null);
    setPrompt("");
    setChatError("");
    clearSelectedImage();
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
  const isBusy = chatLoading || approvalLoading || logoutLoading || imageUploading;

  const renderApprovalDetails = () => {
    if (!pendingApproval) return null;
    if (pendingApproval.type === "email") {
      return (
        <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
          <div><p className="mb-1 text-xs text-zinc-500">To</p><p className="break-all text-sm">{pendingApproval.email.to || "Not provided"}</p></div>
          <div><p className="mb-1 text-xs text-zinc-500">Subject</p><p className="text-sm">{pendingApproval.email.subject || "No subject"}</p></div>
          <div><p className="mb-1 text-xs text-zinc-500">Message</p><p className="whitespace-pre-wrap break-words text-sm text-zinc-300">{pendingApproval.email.body || "No message provided"}</p></div>
        </div>
      );
    }
    if (pendingApproval.type === "calendar") {
      const event = pendingApproval.event;
      return (
        <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
          <div><p className="mb-1 text-xs text-zinc-500">Event title</p><p className="text-sm font-medium">{event.summary || "Untitled event"}</p></div>
          {event.description && <div><p className="mb-1 text-xs text-zinc-500">Description</p><p className="whitespace-pre-wrap text-sm text-zinc-300">{event.description}</p></div>}
          <div><p className="mb-1 text-xs text-zinc-500">Start</p><p className="flex items-center gap-2 text-sm"><CalendarDays size={15} />{event.startDateTime ? new Date(event.startDateTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone }) : "Not provided"}</p></div>
          <div><p className="mb-1 text-xs text-zinc-500">End</p><p className="flex items-center gap-2 text-sm"><Clock size={15} />{event.endDateTime ? new Date(event.endDateTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone }) : "Not provided"}</p></div>
          <p className="text-xs text-zinc-500">Timezone: {event.timeZone}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
        {pendingApproval.imageUrl && (
          <img src={pendingApproval.imageUrl} alt="Instagram post preview" className="max-h-72 w-full rounded-lg object-contain" />
        )}
        <div>
          <p className="mb-1 text-xs text-zinc-500">Caption</p>
          <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">{pendingApproval.caption || "No caption provided"}</p>
        </div>
        {pendingApproval.topic && <p className="text-xs text-zinc-400">Topic: {pendingApproval.topic}</p>}
        {pendingApproval.hashtags.length > 0 && <p className="break-words text-sm text-violet-300">{pendingApproval.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}</p>}
        {pendingApproval.imageUrl && <a href={pendingApproval.imageUrl} target="_blank" rel="noreferrer" className="break-all text-xs text-blue-300 underline">Open image URL</a>}
      </div>
    );
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#2b2f3a_0%,#191b21_55%,#121317_100%)] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="z-30 flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white text-zinc-900"><Workflow size={17} /></span>
            <span className="text-sm font-medium tracking-tight">AutoMate AI</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" aria-label="Open menu" className={iconBtn}><Workflow size={16} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={`w-56 ${menuContent}`}>
                <DropdownMenuItem asChild className={menuItem}><Link to="/agents" className="flex items-center gap-2.5 py-2.5"><Bot size={16} />My agents</Link></DropdownMenuItem>
                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem asChild className={menuItem}><Link to="/agents/new" className="flex items-center gap-2.5 py-2.5"><Plus size={16} />Create new agent</Link></DropdownMenuItem>
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
                <DropdownMenuItem onClick={(event) => { event.preventDefault(); handleLogout(); }} disabled={logoutLoading} className="cursor-pointer gap-2.5 rounded-xl py-2.5 text-red-400 focus:bg-red-500/10 focus:text-red-400"><LogOut size={16} />{logoutLoading ? "Logging out..." : "Logout"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <section className="flex min-h-0 flex-1 flex-col">
            <div className={`min-h-0 flex-1 overflow-y-auto ${hideScrollbar}`}>
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
                {messages.length === 0 && (
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
                    <div className={`max-w-[90%] break-words px-4 py-3 text-sm leading-7 sm:max-w-[80%] ${message.role === "user" ? `rounded-2xl rounded-br-md text-white ${darkPanel}` : "text-zinc-200"}`}>
                      {message.imageUrl && <img src={message.imageUrl} alt="Attached image" className="mb-3 max-h-64 rounded-lg object-contain" />}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {pendingApproval && (
                  <div className={`rounded-2xl p-4 ${darkPanel}`}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className={`flex size-10 items-center justify-center rounded-xl ${pendingApproval.type === "calendar" ? "bg-violet-400/10" : pendingApproval.type === "instagram" ? "bg-pink-400/10" : "bg-amber-400/10"}`}>
                        {pendingApproval.type === "calendar" ? <CalendarDays className="size-5 text-violet-400" /> : pendingApproval.type === "instagram" ? <ImagePlus className="size-5 text-pink-400" /> : <Mail className="size-5 text-amber-400" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{pendingApproval.type === "calendar" ? "Calendar Approval Required" : pendingApproval.type === "instagram" ? "Instagram Publish Approval" : "Email Approval Required"}</h3>
                        <p className="text-xs text-zinc-400">{pendingApproval.type === "instagram" ? "Review the image and caption before publishing." : pendingApproval.type === "calendar" ? "Review the event before creating it." : "Review the email before sending."}</p>
                      </div>
                    </div>
                    {renderApprovalDetails()}
                    <div className="mt-4 flex justify-end gap-2">
                      <Button type="button" variant="outline" disabled={approvalLoading} onClick={() => handleApproval(false)} className="rounded-xl border-red-500/25 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"><X className="mr-2 size-4" />{approvalLoading ? "Processing..." : "Reject"}</Button>
                      <Button type="button" disabled={approvalLoading} onClick={() => handleApproval(true)} className={whiteBtn}><Check className="mr-2 size-4" />{approvalLoading ? "Processing..." : pendingApproval.type === "calendar" ? "Approve & Create" : pendingApproval.type === "instagram" ? "Approve & Publish" : "Approve & Send"}</Button>
                    </div>
                  </div>
                )}

                {chatLoading && <div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-lg bg-white text-zinc-900"><Workflow size={15} className="animate-pulse" /></div><div className="text-sm text-zinc-400">{imageUploading ? "Uploading image to Cloudinary..." : "AutoMate AI is thinking..."}</div></div>}
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
                }} placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : "Ask me anything..."} disabled={isBusy || Boolean(pendingApproval)} className={`min-h-20 resize-none border-0 !bg-transparent px-2 py-1.5 text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0 ${hideScrollbar}`} />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Button type="button" variant="ghost" aria-label="Attach image" title="Attach image" disabled={isBusy || Boolean(pendingApproval)} onClick={() => fileInputRef.current?.click()} className="size-8 rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white"><ImagePlus size={17} /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button type="button" variant="ghost" disabled={isBusy || Boolean(pendingApproval)} className="h-8 max-w-48 gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white"><Bot size={14} className="shrink-0" /><span className="truncate">{loading ? "Loading agents..." : selectedAgent?.name || "Select agent"}</span><ChevronDown size={12} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="top" className={`mb-2 w-60 ${menuContent}`}>
                        {loading && <DropdownMenuItem disabled className={menuItem}>Loading agents...</DropdownMenuItem>}
                        {!loading && !agents.length && <DropdownMenuItem disabled className={menuItem}>No agents found</DropdownMenuItem>}
                        {agents.map((agent) => {
                          const id = String(agent._id ?? agent.id);
                          const selectedId = String(selectedAgent?._id ?? selectedAgent?.id ?? "");
                          return <DropdownMenuItem key={id} onClick={() => { setSelectedAgent(agent); setMessages([]); setThreadId(null); setPendingApproval(null); setPrompt(""); setChatError(""); clearSelectedImage(); }} className={`cursor-pointer gap-2 ${menuItem}`}><Bot size={15} className="shrink-0 text-violet-300" /><span className="truncate">{agent.name}</span>{selectedId === id && <span className="ml-auto text-xs text-violet-300">✓</span>}</DropdownMenuItem>;
                        })}
                        <DropdownMenuSeparator className={menuSeparator} />
                        <DropdownMenuItem asChild className={menuItem}><Link to="/agents/new" className="flex items-center gap-2"><Plus size={15} />Create new agent</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild className={menuItem}><Link to="/agents" className="flex items-center gap-2"><Settings size={15} />Manage agents</Link></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" disabled={isBusy || Boolean(pendingApproval)} onClick={handleNewChat} className="h-8 rounded-lg px-3 text-xs text-zinc-400 hover:bg-white/10 hover:text-white">New chat</Button>
                    <Button type="submit" size="icon" disabled={isBusy || Boolean(pendingApproval) || (!prompt.trim() && !selectedImage)} aria-label="Send message" className={`size-8 shrink-0 ${whiteBtn} disabled:bg-white/10 disabled:text-zinc-500`}><ArrowUp size={16} /></Button>
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
