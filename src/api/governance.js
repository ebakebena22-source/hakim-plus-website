import { apiRequest } from "./client";

function withQuery(path, values) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) query.set(key, String(value).trim());
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const analyticsApi = {
  overview: (range = "30d") => apiRequest(withQuery("/api/v1/admin/analytics", { range })),
};

export const auditApi = {
  list: (filters = {}) => apiRequest(withQuery("/api/v1/admin/audit-logs", filters)),
};

export const securityApi = {
  overview: () => apiRequest("/api/v1/admin/security/overview"),
};

export const activityApi = {
  list: (cursor = "") => apiRequest(withQuery("/api/v1/account-activity", { cursor })),
};

