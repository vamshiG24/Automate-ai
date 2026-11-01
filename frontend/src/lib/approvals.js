// Shared by the chat page and the Agent Teams page

export function getInterrupt(response) {
  const item = response?.interrupts?.[0];
  return item?.value ?? item;
}

// Convert a LangGraph interrupt into the approval card state + a chat note
export function buildApproval(approvalData, common) {
  if (!approvalData) return null;

  const risk = approvalData.risk ?? null;

  if (approvalData.type === "email_approval" && approvalData.email) {
    return {
      approval: {
        ...common,
        risk,
        type: "email",
        email: {
          to: approvalData.email.to ?? "",
          subject: approvalData.email.subject ?? "",
          body: approvalData.email.body ?? "",
        },
      },
      note: "Email bhejne se pehle details review karein aur approval dein.",
    };
  }

  if (approvalData.type === "calendar_approval" && approvalData.event) {
    return {
      approval: {
        ...common,
        risk,
        type: "calendar",
        event: {
          summary: approvalData.event.summary ?? "",
          description: approvalData.event.description ?? "",
          startDateTime: approvalData.event.startDateTime ?? "",
          endDateTime: approvalData.event.endDateTime ?? "",
          timeZone: approvalData.event.timeZone ?? "Asia/Kolkata",
        },
      },
      note: "Calendar event create karne se pehle details review karein aur approval dein.",
    };
  }

  // Expected interrupt payload from LangGraph:
  // { type: "instagram_publish_approval", imageUrl, caption, topic, imageDescription, hashtags }
  if (
    ["instagram_publish_approval", "instagram_approval", "publish_instagram_image_approval"]
      .includes(approvalData.type)
  ) {
    return {
      approval: {
        ...common,
        risk,
        type: "instagram",
        imageUrl: approvalData.imageUrl ?? approvalData.image_url ?? "",
        caption: approvalData.caption ?? "",
        topic: approvalData.topic ?? "",
        imageDescription: approvalData.imageDescription ?? "",
        hashtags: Array.isArray(approvalData.hashtags)
          ? approvalData.hashtags
          : [],
      },
      note: "Instagram par publish karne se pehle image aur caption review karein.",
    };
  }

  return null;
}

const TOOL_LABELS = {
  send_email: "Email",
  create_calendar_event: "Calendar event",
  publish_instagram_image: "Instagram post",
};

// Chat note for actions the risk engine approved automatically
export function describeAutoApprovals(autoApprovals = []) {
  return autoApprovals.map((item) => {
    const label = TOOL_LABELS[item.toolName] || item.toolName;
    const target = item.toolName === "send_email" ? ` to ${item.target}` : "";
    const why = item.trustSignals?.length ? ` ${item.trustSignals.join(". ")}.` : "";
    return `✅ ${label}${target} was auto-approved (low risk, score ${item.score}/100).${why}`;
  });
}
