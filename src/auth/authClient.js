import { apiConfiguration, apiRequest } from "../api/client";
import { normalizedCountryProfile } from "../profile/countries";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const localPreviewEnabled = !apiConfiguration.configured && typeof window !== "undefined" && localHosts.has(window.location.hostname);
const accountsKey = "hakim-plus-preview-accounts-v1";
const sessionKey = "hakim-plus-preview-session-v1";

export const authConfiguration = {
  ...apiConfiguration,
  configured: apiConfiguration.configured || localPreviewEnabled,
  mode: apiConfiguration.configured ? "api" : localPreviewEnabled ? "local-preview" : "unconfigured",
};

function readAccounts() {
  try {
    return JSON.parse(window.localStorage.getItem(accountsKey) || "[]");
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  window.localStorage.setItem(accountsKey, JSON.stringify(accounts));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function publicUser(account) {
  return account?.user ? structuredClone(account.user) : null;
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const localAuthClient = {
  async getSession() {
    const userId = window.localStorage.getItem(sessionKey);
    const account = readAccounts().find((candidate) => candidate.user.id === userId);
    return { user: publicUser(account) };
  },
  async signUp(details) {
    const email = normalizeEmail(details.email);
    const accounts = readAccounts();
    if (accounts.some((account) => account.user.email === email)) throw new Error("An account with this email already exists. Sign in instead.");
    if (String(details.password || "").length < 12) throw new Error("Use a password with at least 12 characters.");
    const countryProfile = normalizedCountryProfile(details.countryCode || details.country);
    if (!countryProfile) throw new Error("Choose a valid country from the country list.");
    const salt = randomSalt();
    const user = {
      id: crypto.randomUUID(),
      email,
      name: [details.firstName, details.lastName].filter(Boolean).join(" "),
      profile: {
        firstName: String(details.firstName || "").trim(),
        lastName: String(details.lastName || "").trim(),
        phone: String(details.phone || "").trim(),
        ...countryProfile,
      },
      roles: ["customer"],
      emailVerified: true,
      previewAccount: true,
    };
    accounts.push({ user, salt, passwordHash: await hashPassword(details.password, salt) });
    writeAccounts(accounts);
    window.localStorage.setItem(sessionKey, user.id);
    return { user: structuredClone(user), requiresVerification: false };
  },
  async signIn(credentials) {
    const account = readAccounts().find((candidate) => candidate.user.email === normalizeEmail(credentials.email));
    if (!account || await hashPassword(credentials.password, account.salt) !== account.passwordHash) throw new Error("Email or password is incorrect.");
    window.localStorage.setItem(sessionKey, account.user.id);
    return { user: publicUser(account) };
  },
  async signOut() {
    window.localStorage.removeItem(sessionKey);
    return { ok: true };
  },
  async socialSignIn() {
    throw new Error("Social sign-in is available only on the production website.");
  },
  async requestPasswordReset() {
    return { ok: true, localPreview: true };
  },
  async resetPassword() {
    throw new Error("Password reset emails are unavailable in local preview mode. Create another preview account or connect the production account service.");
  },
};

const apiAuthClient = {
  getSession: () => apiRequest("/api/v1/auth/session"),
  signIn: (credentials) => apiRequest("/api/v1/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  signUp: (details) => apiRequest("/api/v1/auth/register", { method: "POST", body: JSON.stringify(details) }),
  socialSignIn: (provider) => apiRequest("/api/v1/auth/social", { method: "POST", body: JSON.stringify({ provider }) }),
  completeSocialSignIn: (verifier) => apiRequest(`/api/v1/auth/social-complete?verifier=${encodeURIComponent(verifier)}`),
  signOut: () => apiRequest("/api/v1/auth/logout", { method: "POST" }),
  requestPasswordReset: (email) => apiRequest("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (payload) => apiRequest("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
};

export const authClient = localPreviewEnabled ? localAuthClient : apiAuthClient;
