// Team chat talks to the server over a live event stream (Server-Sent
// Events on a POST). Each event, e.g. "member_start" or "member_done",
// is passed to onEvent(event, data) as soon as it arrives.

const BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";

const streamEvents = async (path, body, onEvent) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Validation errors come back as normal JSON before any stream starts
  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
    let message = "Request failed. Please try again.";
    try {
      message = (await response.json()).message || message;
    } catch {
      // Not JSON; keep the generic message
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const event = chunk.match(/^event: (.+)$/m)?.[1];
      const data = chunk.match(/^data: (.+)$/m)?.[1];
      if (event) onEvent(event, data ? JSON.parse(data) : {});
    }
  }
};

export const sendTeamMessageStream = ({ agentId, message, threadId }, onEvent) =>
  streamEvents("/api/team-chat/message", { agentId, message, ...(threadId ? { threadId } : {}) }, onEvent);

export const approveTeamActionStream = ({ agentId, threadId, approved }, onEvent) =>
  streamEvents("/api/team-chat/approve", { agentId, threadId, approved }, onEvent);
