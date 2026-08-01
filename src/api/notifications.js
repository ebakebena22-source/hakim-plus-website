import { apiRequest } from "./client";

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export const notificationsApi = {
  list: ({ view = "all", cursor = "" } = {}) => {
    const query = new URLSearchParams({ view });
    if (cursor) query.set("cursor", cursor);
    return apiRequest(`/api/v1/notifications?${query.toString()}`);
  },
  unreadCount: () => apiRequest("/api/v1/notifications/unread-count"),
  markRead: (id) => apiRequest(`/api/v1/notifications/${encodeId(id)}/read`, { method: "POST" }),
  markAllRead: () => apiRequest("/api/v1/notifications/read-all", { method: "POST" }),
  getPreferences: () => apiRequest("/api/v1/communication-preferences"),
  updatePreferences: (preferences) => apiRequest("/api/v1/communication-preferences", { method: "PUT", body: JSON.stringify(preferences) }),
};
