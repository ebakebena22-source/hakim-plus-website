import { apiRequest } from "./client";

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export const adminApi = {
  dashboard: () => apiRequest("/api/v1/admin/dashboard"),
  listRequests: ({ queue = "all", search = "" } = {}) => {
    const query = new URLSearchParams();
    if (queue !== "all") query.set("queue", queue);
    if (search.trim()) query.set("search", search.trim());
    return apiRequest(`/api/v1/admin/requests?${query.toString()}`);
  },
  getRequest: (id) => apiRequest(`/api/v1/admin/requests/${encodeId(id)}`),
  updateRequestStatus: (id, payload) =>
    apiRequest(`/api/v1/admin/requests/${encodeId(id)}/status`, { method: "POST", body: JSON.stringify(payload) }),
  addInternalNote: (id, note) =>
    apiRequest(`/api/v1/admin/requests/${encodeId(id)}/internal-notes`, { method: "POST", body: JSON.stringify({ note }) }),
  sendCustomerMessage: (id, message) =>
    apiRequest(`/api/v1/admin/requests/${encodeId(id)}/customer-messages`, { method: "POST", body: JSON.stringify({ message }) }),
  recordBeneficiaryContact: (id, payload) =>
    apiRequest(`/api/v1/admin/requests/${encodeId(id)}/beneficiary-contact`, { method: "POST", body: JSON.stringify(payload) }),
  cancelRequest: (id, reason) =>
    apiRequest(`/api/v1/admin/requests/${encodeId(id)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  markUnableToFulfill: (id, reason) =>
    apiRequest(`/api/v1/admin/requests/${encodeId(id)}/unable-to-fulfill`, { method: "POST", body: JSON.stringify({ reason }) }),
};
