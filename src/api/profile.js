import { apiRequest } from "./client";

export const profileApi = {
  get: () => apiRequest("/api/v1/profile"),
  update: (profile) => apiRequest("/api/v1/profile", { method: "PUT", body: JSON.stringify(profile) }),
};
