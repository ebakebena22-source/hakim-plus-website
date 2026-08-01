import { apiRequest } from "./client";

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export const messagesApi = {
  getRequestThread: (requestId, { cursor = "" } = {}) => {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return apiRequest(`/api/v1/medication-requests/${encodeId(requestId)}/messages${query}`);
  },
  sendRequestMessage: (requestId, payload) => apiRequest(`/api/v1/medication-requests/${encodeId(requestId)}/messages`, { method: "POST", body: JSON.stringify(payload) }),
};
