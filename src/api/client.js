const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const ADMIN_ACTION_COUNTS_CHANGED_EVENT = "hakim-plus:admin-action-counts-changed";

export class ApiConfigurationError extends Error {
  constructor() {
    super("The secure Hakim Plus account service has not been connected yet.");
    this.name = "ApiConfigurationError";
  }
}

export const apiConfiguration = {
  // Vercel Functions are served from the same origin in production. Keeping the
  // base URL empty avoids hard-coding a deployment hostname or custom domain.
  configured: Boolean(apiBaseUrl) || import.meta.env.PROD,
  apiBaseUrl,
};

export async function apiRequest(path, options = {}) {
  if (!apiConfiguration.configured) throw new ApiConfigurationError();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "We could not complete that request.");
    error.status = response.status;
    error.details = payload.errors;
    throw error;
  }

  const method = String(options.method || "GET").toUpperCase();
  if (method !== "GET" && path.startsWith("/api/v1/admin/") && typeof window !== "undefined") {
    window.dispatchEvent(new Event(ADMIN_ACTION_COUNTS_CHANGED_EVENT));
  }

  return payload;
}
