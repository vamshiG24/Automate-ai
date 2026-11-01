import api from "@/api";



// Fetch all agents
export const fetchAgentsApi = async () => {
  const response = await api.get("/api/agents");
  return response.data;
};

// Fetch single agent
export const fetchAgentByIdApi = async (agentId) => {
  const response = await api.get(`/api/agents/${agentId}`);
  return response.data;
};

// Create agent
export const createAgentApi = async (agentData) => {
  const response = await api.post("/api/agents", agentData);
  return response.data;
};

// Update agent
export const updateAgentApi = async (agentId, agentData) => {
  const response = await api.put(`/api/agents/${agentId}`, agentData);
  return response.data;
};

// Delete agent
export const deleteAgentApi = async (agentId) => {
  const response = await api.delete(`/api/agents/${agentId}`);
  return response.data;
};
