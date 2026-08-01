import { apiRequest } from "./client";

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export const beneficiariesApi = {
  list: ({ includeArchived = false } = {}) =>
    apiRequest(`/api/v1/beneficiaries?includeArchived=${includeArchived ? "true" : "false"}`),
  get: (id) => apiRequest(`/api/v1/beneficiaries/${encodeId(id)}`),
  create: (beneficiary) =>
    apiRequest("/api/v1/beneficiaries", { method: "POST", body: JSON.stringify(beneficiary) }),
  update: (id, beneficiary) =>
    apiRequest(`/api/v1/beneficiaries/${encodeId(id)}`, { method: "PATCH", body: JSON.stringify(beneficiary) }),
  archive: (id) =>
    apiRequest(`/api/v1/beneficiaries/${encodeId(id)}/archive`, { method: "POST" }),
};
