import { apiRequest } from "./client";

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export const paymentsApi = {
  getCheckoutContext: (requestId) => apiRequest(`/api/v1/medication-requests/${encodeId(requestId)}/payment`),
  submitBankTransfer: (requestId, payload) => apiRequest(`/api/v1/medication-requests/${encodeId(requestId)}/bank-transfer`, {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  list: () => apiRequest("/api/v1/payments"),
  get: (paymentId) => apiRequest(`/api/v1/payments/${encodeId(paymentId)}`),
  getReceipt: (paymentId) => apiRequest(`/api/v1/payments/${encodeId(paymentId)}/receipt`),
};

export const adminTransfersApi = {
  list: (status = "pending") => apiRequest(`/api/v1/admin/bank-transfers?status=${encodeURIComponent(status)}`),
  approve: (id, note = "") => apiRequest(`/api/v1/admin/bank-transfers/${encodeId(id)}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
  reject: (id, reason) => apiRequest(`/api/v1/admin/bank-transfers/${encodeId(id)}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  receiptUrl: (id) => `/api/v1/admin/bank-transfers/${encodeId(id)}/receipt`,
};
