import api from "@/api";



export const fetchMeApi = async () => {
  const response = await api.get("/api/auth/me");
  return response.data.user;
};

export const loginApi = async (token) => {
  const response = await api.post(
    "/api/auth/login",
    {token},
    
  );
  return response.data;
};

export const logoutApi = async () => {
  const response = await api.post("/api/auth/logout");
  return response.data;
};
// Risk-based approval preference
export const updateSettingsApi = async (settings) => {
  const response = await api.patch("/api/auth/settings", settings);
  return response.data.settings;
};
