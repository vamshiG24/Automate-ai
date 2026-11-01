import api from "@/api";

// List chat history for the sidebar (optionally filtered by title)
export const fetchConversationsApi = async (search = "") => {
  const response = await api.get("/api/conversations", {
    params: search ? { search } : {},
  });
  return response.data.conversations;
};

// Load one conversation with its messages
export const fetchConversationApi = async (threadId) => {
  const response = await api.get(
    `/api/conversations/${encodeURIComponent(threadId)}`
  );
  return response.data.conversation;
};

// Rename or pin/unpin a conversation
export const updateConversationApi = async (threadId, updates) => {
  const response = await api.patch(
    `/api/conversations/${encodeURIComponent(threadId)}`,
    updates
  );
  return response.data.conversation;
};

export const deleteConversationApi = async (threadId) => {
  const response = await api.delete(
    `/api/conversations/${encodeURIComponent(threadId)}`
  );
  return response.data;
};
