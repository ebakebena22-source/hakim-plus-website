import { apiRequest } from "./client";

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export const requestsApi = {
  list: ({ status = "all", search = "" } = {}) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (search.trim()) query.set("search", search.trim());
    return apiRequest(`/api/v1/medication-requests?${query.toString()}`);
  },
  get: (id) => apiRequest(`/api/v1/medication-requests/${encodeId(id)}`),
  create: (request) =>
    apiRequest("/api/v1/medication-requests", { method: "POST", body: JSON.stringify(request) }),
};
