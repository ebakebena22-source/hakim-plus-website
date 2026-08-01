import { apiRequest } from "../api/client";

const allowedEvents = new Set([
  "quote_viewed",
  "payment_checkout_started",
  "communication_preferences_opened",
]);

const allowedContextKeys = new Set(["source", "channel", "result", "currency"]);

export function recordSafeEvent(name, context = {}) {
  if (!allowedEvents.has(name)) return Promise.resolve();
  const safeContext = Object.fromEntries(Object.entries(context).filter(([key, value]) => allowedContextKeys.has(key) && ["string", "number", "boolean"].includes(typeof value)));
  return apiRequest("/api/v1/analytics/events", {
    method: "POST",
    body: JSON.stringify({ name, context: safeContext }),
  }).catch(() => undefined);
}

