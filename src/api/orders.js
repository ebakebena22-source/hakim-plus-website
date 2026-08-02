import { apiRequest } from "./client";

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export const ordersApi = {
  list: ({ view = "active" } = {}) => apiRequest(`/api/v1/orders?view=${encodeURIComponent(view)}`),
  get: (id) => apiRequest(`/api/v1/orders/${encodeId(id)}`),
  requestAgain: (id) => apiRequest(`/api/v1/orders/${encodeId(id)}/request-again`, { method: "POST" }),
};

export const adminOrdersApi = {
  list: ({ queue = "active", search = "" } = {}) => {
    const query = new URLSearchParams({ queue });
    if (search.trim()) query.set("search", search.trim());
    return apiRequest(`/api/v1/admin/orders?${query.toString()}`);
  },
  get: (id) => apiRequest(`/api/v1/admin/orders/${encodeId(id)}`),
  assignDelivery: (id, payload) => apiRequest(`/api/v1/admin/orders/${encodeId(id)}/delivery-assignment`, { method: "POST", body: JSON.stringify(payload) }),
  dispatch: (id, payload) => apiRequest(`/api/v1/admin/orders/${encodeId(id)}/dispatch`, { method: "POST", body: JSON.stringify(payload) }),
  confirmDelivery: (id, payload) => apiRequest(`/api/v1/admin/orders/${encodeId(id)}/delivery-confirmation`, { method: "POST", body: JSON.stringify(payload) }),
  recordDeliveryFailure: (id, payload) => apiRequest(`/api/v1/admin/orders/${encodeId(id)}/delivery-failure`, { method: "POST", body: JSON.stringify(payload) }),
};
