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
console.log(response)
  return response.data;
};

export const logoutApi = async () => {
  const response = await api.post("/api/auth/logout");
  return response.data;
};