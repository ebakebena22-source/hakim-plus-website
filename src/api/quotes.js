import { apiRequest } from "./client";

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export const quotesApi = {
  getForRequest: (requestId) => apiRequest(`/api/v1/medication-requests/${encodeId(requestId)}/quote`),
  approve: (quoteId, payload) => apiRequest(`/api/v1/quotes/${encodeId(quoteId)}/approve`, { method: "POST", body: JSON.stringify(payload) }),
  requestChange: (quoteId, message) => apiRequest(`/api/v1/quotes/${encodeId(quoteId)}/request-change`, { method: "POST", body: JSON.stringify({ message }) }),
  decline: (quoteId, reason) => apiRequest(`/api/v1/quotes/${encodeId(quoteId)}/decline`, { method: "POST", body: JSON.stringify({ reason }) }),
};

export const adminQuotesApi = {
  getForRequest: (requestId) => apiRequest(`/api/v1/admin/requests/${encodeId(requestId)}/quote`),
  saveDraft: (requestId, quote) => apiRequest(`/api/v1/admin/requests/${encodeId(requestId)}/quote`, { method: "PUT", body: JSON.stringify(quote) }),
  send: (requestId) => apiRequest(`/api/v1/admin/requests/${encodeId(requestId)}/quote/send`, { method: "POST" }),
};
