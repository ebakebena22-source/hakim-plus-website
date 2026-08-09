import { apiRequest } from "./client";

const attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];

export function landingAttribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    landingUrl: window.location.href,
    ...Object.fromEntries(attributionKeys.map((key) => [key, params.get(key) || ""])),
  };
}

export function createDiasporaCareRequest(payload) {
  return apiRequest("/api/v1/diaspora-care-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

