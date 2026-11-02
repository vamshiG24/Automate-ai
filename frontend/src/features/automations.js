import api from "@/api";

export const fetchAutomationsApi = async () => {
  const response = await api.get("/api/automations");
  return response.data.automations;
};

// Save a reviewed team run as a scheduled automation
export const createAutomationApi = async ({ runId, name, schedule }) => {
  const response = await api.post("/api/automations", { runId, name, schedule });
  return response.data.automation;
};

// { name?, enabled?, schedule? }
export const updateAutomationApi = async (id, updates) => {
  const response = await api.patch(`/api/automations/${id}`, updates);
  return response.data.automation;
};

export const runAutomationNowApi = async (id) => {
  const response = await api.post(`/api/automations/${id}/run`);
  return response.data.runId;
};

export const deleteAutomationApi = async (id) => {
  const response = await api.delete(`/api/automations/${id}`);
  return response.data;
};

// Team runs waiting for approval (alerts + badge)
export const fetchPendingApprovalsApi = async () => {
  const response = await api.get("/api/team/pending");
  return response.data;
};
