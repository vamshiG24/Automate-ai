import api from "@/api";

export const sendMessageApi = async ({ message, threadId }) => {
  const response = await api.post("/api/chat", {
    message,
    ...(threadId ? { threadId } : {}),
  });

  return response.data.data;
};

export const agentChat = async ({ message, threadId, agentId }) => {
  const response = await api.post("/api/agent-chat", {
    message,
    ...(threadId ? { threadId } : {}),
    agentId,
  });

  return response.data.data;
};

// Approve or reject an email
export const approveEmailApi = async ({ agentId, threadId, approved }) => {
  const response = await api.post("/api/agent-chat/approve-email", {
    agentId,
    threadId,
    approved,
  });

  return response.data.data;
};