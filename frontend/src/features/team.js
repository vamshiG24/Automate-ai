import api from "@/api";

// Ask the Planner to build a team for one instruction
export const planTeamApi = async (instruction) => {
  const response = await api.post("/api/team/plan", { instruction });
  return response.data;
};

export const fetchTeamRunsApi = async () => {
  const response = await api.get("/api/team/runs");
  return response.data.runs;
};

export const fetchTeamRunApi = async (runId) => {
  const response = await api.get(`/api/team/runs/${runId}`);
  return response.data.run;
};

// Edit or remove steps before running
export const updateTeamPlanApi = async (runId, steps) => {
  const response = await api.patch(`/api/team/runs/${runId}`, { steps });
  return response.data.run;
};

export const executeTeamRunApi = async (runId) => {
  const response = await api.post(`/api/team/runs/${runId}/execute`);
  return response.data.run;
};

export const approveTeamStepApi = async (runId, approved) => {
  const response = await api.post(`/api/team/runs/${runId}/approve`, { approved });
  return response.data.run;
};

export const deleteTeamRunApi = async (runId) => {
  const response = await api.delete(`/api/team/runs/${runId}`);
  return response.data;
};

// Safety numbers from the risk engine (for the report / evaluation)
export const fetchApprovalStatsApi = async () => {
  const response = await api.get("/api/approvals/stats");
  return response.data.stats;
};
