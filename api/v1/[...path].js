import { neon } from "@neondatabase/serverless";
import { get, put } from "@vercel/blob";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { normalizedCountryProfile } from "../../src/profile/countries.js";

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POSTGRES_URL;
const sql = connectionString ? neon(connectionString) : null;
let schemaPromise;

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "ebakebena22@gmail.com").trim().toLowerCase();
const BANK = {
  bankName: process.env.BANK_NAME || "Commercial Bank of Ethiopia",
  accountName: process.env.BANK_ACCOUNT_NAME || "EK International Trading PLC",
  accountNumber: process.env.BANK_ACCOUNT_NUMBER || "1000746304483",
  swift: process.env.BANK_SWIFT || "CBETETAA",
};

function send(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(payload));
}

function fail(res, status, message, errors) {
  return send(res, status, { message, ...(errors ? { errors } : {}) });
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function normalizeCookie(cookie) {
  return cookie
    .replace(/;\s*Domain=[^;]+/gi, "")
    .replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
}

function copyAuthCookies(upstream, res) {
  const cookies = typeof upstream.headers.getSetCookie === "function"
    ? upstream.headers.getSetCookie()
    : upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")] : [];
  if (cookies.length) res.setHeader("Set-Cookie", cookies.map(normalizeCookie));
}

function authBaseUrl() {
  return String(process.env.DATABASE_NEON_AUTH_BASE_URL || process.env.NEON_AUTH_BASE_URL || "").replace(/\/$/, "");
}

async function callAuth(req, endpoint, options = {}) {
  const baseUrl = authBaseUrl();
  if (!baseUrl) throw Object.assign(new Error("Authentication is not configured."), { status: 503 });
  const allowedOrigins = new Set([
    "https://hakimpluspharmacy.com",
    "https://www.hakimpluspharmacy.com",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ]);
  if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) {
    throw Object.assign(new Error("This request origin is not allowed."), { status: 403 });
  }
  const headers = { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) };
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  // Neon Auth validates the server-to-server hop against its own trusted
  // origin. The customer-facing origin is validated above and never forwarded.
  headers.Origin = new URL(baseUrl).origin;
  return fetch(`${baseUrl}${endpoint}`, { method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined, redirect: "manual" });
}

function authPayload(payload) {
  return payload?.data || payload || {};
}

async function handleAuth(req, res, action) {
  let endpoint;
  let method = req.method;
  let body;
  if (action === "register" && method === "POST") {
    const form = await readJson(req);
    if (!form.email || !form.firstName || !form.lastName || String(form.password || "").length < 12) return fail(res, 400, "Enter your name, email, and a password with at least 12 characters.");
    const countryProfile = normalizedCountryProfile(form.countryCode || form.country);
    if (!countryProfile) return fail(res, 400, "Choose a valid country from the complete country list.");
    if (form.termsAccepted !== true || form.privacyAccepted !== true) return fail(res, 400, "Agree to the Terms of Use and Privacy Policy to create an account.");
    endpoint = "/sign-up/email";
    body = { email: String(form.email).trim().toLowerCase(), password: form.password, name: `${form.firstName} ${form.lastName}`.trim() };
    const upstream = await callAuth(req, endpoint, { method: "POST", body });
    copyAuthCookies(upstream, res);
    const payload = authPayload(await upstream.json().catch(() => ({})));
    if (!upstream.ok) return fail(res, upstream.status, payload.message || "The account could not be created.");
    let user = payload.user || payload;
    if (user?.id) await upsertProfile(user, { firstName: String(form.firstName).trim(), lastName: String(form.lastName).trim(), phone: String(form.phone || "").trim(), ...countryProfile, legalAcceptedAt: new Date().toISOString(), termsVersion: "2026-08-02", privacyVersion: "2026-08-02" });

    // Neon Auth can be configured to allow password sign-up without email
    // verification. Its sign-up response does not always include a session in
    // that mode, so establish the session explicitly instead of incorrectly
    // sending every new customer to a verification page that never emails.
    let accountReady = Boolean(payload.session);
    if (!accountReady) {
      const signInUpstream = await callAuth(req, "/sign-in/email", { method: "POST", body: { email: body.email, password: body.password } });
      const signInPayload = authPayload(await signInUpstream.json().catch(() => ({})));
      if (signInUpstream.ok) {
        copyAuthCookies(signInUpstream, res);
        user = signInPayload.user || user;
        accountReady = true;
      }
    }

    const requiresVerification = !accountReady && user?.emailVerified !== true;
    return send(res, 200, { user: accountReady ? await publicUser(user) : null, requiresVerification });
  }
  if (action === "login" && method === "POST") {
    const form = await readJson(req);
    const upstream = await callAuth(req, "/sign-in/email", { method: "POST", body: { email: String(form.email || "").trim().toLowerCase(), password: form.password } });
    copyAuthCookies(upstream, res);
    const payload = authPayload(await upstream.json().catch(() => ({})));
    if (!upstream.ok) return fail(res, 401, payload.message || "Email or password is incorrect.");
    if (payload.user?.id) await upsertProfile(payload.user);
    return send(res, 200, { user: await publicUser(payload.user) });
  }
  if (action === "social" && method === "POST") {
    const form = await readJson(req);
    const provider = String(form.provider || "").toLowerCase();
    if (!["google", "apple"].includes(provider)) return fail(res, 400, "Choose Google or Apple sign-in.");
    const callbackURL = "https://hakimpluspharmacy.com/auth/social-complete";
    const upstream = await callAuth(req, "/sign-in/social", { method: "POST", body: { provider, callbackURL, errorCallbackURL: `${callbackURL}?error=oauth` } });
    copyAuthCookies(upstream, res);
    const payload = authPayload(await upstream.json().catch(() => ({})));
    if (!upstream.ok) return fail(res, upstream.status, payload.message || `${provider === "google" ? "Google" : "Apple"} sign-in is not available yet.`);
    const redirectUrl = payload.url || upstream.headers.get("location");
    if (!redirectUrl) return fail(res, 502, "The account service did not return a social sign-in URL.");
    return send(res, 200, { url: redirectUrl, provider });
  }
  if (action === "session" && method === "GET") {
    const session = await getAuthSession(req);
    return send(res, 200, { user: session ? await publicUser(session.user) : null });
  }
  if (action === "logout" && method === "POST") {
    const upstream = await callAuth(req, "/sign-out", { method: "POST" });
    copyAuthCookies(upstream, res);
    return send(res, 200, { ok: upstream.ok });
  }
  if (action === "forgot-password" && method === "POST") {
    const form = await readJson(req);
    await callAuth(req, "/forget-password", { method: "POST", body: { email: String(form.email || "").trim().toLowerCase(), redirectTo: "https://hakimpluspharmacy.com/reset-password" } });
    return send(res, 200, { ok: true });
  }
  if (action === "reset-password" && method === "POST") {
    const form = await readJson(req);
    const upstream = await callAuth(req, "/reset-password", { method: "POST", body: { token: form.token, newPassword: form.password } });
    const payload = authPayload(await upstream.json().catch(() => ({})));
    if (!upstream.ok) return fail(res, upstream.status, payload.message || "The reset link is invalid or expired.");
    return send(res, 200, { ok: true });
  }
  return fail(res, 404, "Authentication route not found.");
}

async function getAuthSession(req) {
  const upstream = await callAuth(req, "/get-session");
  if (!upstream.ok) return null;
  const payload = authPayload(await upstream.json().catch(() => ({})));
  const user = payload.user || payload.session?.user;
  if (!user?.id) return null;
  await upsertProfile(user);
  return { user };
}

async function requireUser(req, res, staffRoles) {
  const session = await getAuthSession(req);
  if (!session) { fail(res, 401, "Sign in to continue."); return null; }
  const user = await publicUser(session.user);
  if (staffRoles && !user.roles.some((role) => staffRoles.includes(role))) {
    fail(res, 403, "You do not have permission to perform this action.");
    return null;
  }
  return user;
}

async function upsertProfile(authUser, profile = {}) {
  await ensureSchema();
  const email = String(authUser.email || "").trim().toLowerCase();
  const existing = await sql`SELECT roles, profile FROM app_profiles WHERE user_id = ${authUser.id}`;
  const canBecomeAdmin = email === ADMIN_EMAIL && authUser.emailVerified === true;
  const roles = existing[0]?.roles?.length ? existing[0].roles : ["customer"];
  if (canBecomeAdmin) for (const role of ["admin", "pharmacist"]) if (!roles.includes(role)) roles.push(role);
  const mergedProfile = { ...(existing[0]?.profile || {}), ...profile };
  const countryProfile = normalizedCountryProfile(mergedProfile.countryCode || mergedProfile.country || mergedProfile.countryName);
  if (countryProfile) Object.assign(mergedProfile, countryProfile);
  await sql`INSERT INTO app_profiles (user_id, email, full_name, profile, roles)
    VALUES (${authUser.id}, ${email}, ${authUser.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim()}, ${JSON.stringify(mergedProfile)}::jsonb, ${roles})
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_profiles.full_name), profile = app_profiles.profile || EXCLUDED.profile, roles = EXCLUDED.roles, updated_at = now()`;
}

async function publicUser(authUser) {
  if (!authUser?.id) return null;
  const rows = await sql`SELECT * FROM app_profiles WHERE user_id = ${authUser.id}`;
  const row = rows[0];
  return { id: authUser.id, email: authUser.email, name: row?.full_name || authUser.name, profile: row?.profile || {}, roles: row?.roles || ["customer"], emailVerified: authUser.emailVerified === true };
}

async function ensureSchema() {
  if (!sql) throw Object.assign(new Error("Production database is not connected."), { status: 503 });
  if (!schemaPromise) schemaPromise = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS app_profiles (
      user_id text PRIMARY KEY, email text NOT NULL UNIQUE, full_name text NOT NULL DEFAULT '', profile jsonb NOT NULL DEFAULT '{}'::jsonb,
      roles text[] NOT NULL DEFAULT ARRAY['customer']::text[], created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS beneficiaries (
      id text PRIMARY KEY, owner_user_id text NOT NULL REFERENCES app_profiles(user_id), data jsonb NOT NULL,
      archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS beneficiaries_owner_idx ON beneficiaries(owner_user_id, created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS protected_files (
      id text PRIMARY KEY, owner_user_id text NOT NULL REFERENCES app_profiles(user_id), kind text NOT NULL,
      blob_url text NOT NULL, pathname text NOT NULL, file_name text NOT NULL, content_type text NOT NULL, size_bytes integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`ALTER TABLE protected_files ADD COLUMN IF NOT EXISTS target_id text`;
    await sql`CREATE TABLE IF NOT EXISTS medication_requests (
      id text PRIMARY KEY, owner_user_id text NOT NULL REFERENCES app_profiles(user_id), beneficiary_id text NOT NULL REFERENCES beneficiaries(id),
      request_number text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'submitted', data jsonb NOT NULL,
      status_history jsonb NOT NULL DEFAULT '[]'::jsonb, internal_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
      customer_messages jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS requests_owner_idx ON medication_requests(owner_user_id, created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS quotes (
      id text PRIMARY KEY, request_id text NOT NULL UNIQUE REFERENCES medication_requests(id), quote_number text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'draft', data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, approved_at timestamptz)`;
    await sql`CREATE TABLE IF NOT EXISTS bank_transfers (
      id text PRIMARY KEY, request_id text NOT NULL REFERENCES medication_requests(id), quote_id text NOT NULL REFERENCES quotes(id),
      owner_user_id text NOT NULL REFERENCES app_profiles(user_id), transfer_number text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending',
      amount_minor integer NOT NULL, currency text NOT NULL, transfer_reference text, transfer_date date,
      blob_url text NOT NULL, pathname text NOT NULL, file_name text NOT NULL, content_type text NOT NULL,
      rejection_reason text, reviewed_by text, review_note text, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS bank_transfer_one_open_idx ON bank_transfers(request_id) WHERE status IN ('pending','approved')`;
    await sql`CREATE TABLE IF NOT EXISTS payments (
      id text PRIMARY KEY, transfer_id text NOT NULL UNIQUE REFERENCES bank_transfers(id), request_id text NOT NULL REFERENCES medication_requests(id),
      owner_user_id text NOT NULL REFERENCES app_profiles(user_id), payment_number text NOT NULL UNIQUE, amount_minor integer NOT NULL, currency text NOT NULL,
      status text NOT NULL DEFAULT 'confirmed', paid_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS orders (
      id text PRIMARY KEY, payment_id text NOT NULL UNIQUE REFERENCES payments(id), request_id text NOT NULL UNIQUE REFERENCES medication_requests(id),
      owner_user_id text NOT NULL REFERENCES app_profiles(user_id), order_number text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'payment_confirmed',
      data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`UPDATE orders SET status='payment_confirmed', updated_at=now() WHERE status IN ('preparing','preparing_order','ready_for_delivery')`;
    await sql`UPDATE orders SET status='completed', updated_at=now() WHERE status='delivered'`;
    await sql`UPDATE medication_requests SET status='paid', updated_at=now() WHERE status IN ('preparing','preparing_order','ready_for_delivery')`;
    await sql`UPDATE medication_requests SET status='completed', updated_at=now() WHERE status='delivered'`;
    await sql`CREATE TABLE IF NOT EXISTS audit_events (
      id text PRIMARY KEY, actor_user_id text, event_type text NOT NULL, target_type text, target_id text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS notifications (
      id text PRIMARY KEY, owner_user_id text NOT NULL REFERENCES app_profiles(user_id), title text NOT NULL, message text NOT NULL,
      action_path text, action_label text, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS notifications_owner_idx ON notifications(owner_user_id, created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS communication_preferences (
      user_id text PRIMARY KEY REFERENCES app_profiles(user_id), data jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now())`;
  })().catch((error) => { schemaPromise = undefined; throw error; });
  return schemaPromise;
}

function numberCode(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function statusLabel(status) {
  const labels = { submitted: "Submitted", under_review: "Under review", under_pharmacy_review: "Under pharmacy review", additional_information_required: "Additional information required", awaiting_information: "Information requested", contacting_beneficiary: "Contacting beneficiary", prescription_verification: "Prescription verification", checking_availability: "Checking availability", quote_ready: "Quote ready", awaiting_payment: "Awaiting payment", payment_verification: "Transfer awaiting verification", paid: "Payment confirmed", payment_confirmed: "Payment confirmed", preparing: "Payment confirmed", preparing_order: "Payment confirmed", ready_for_delivery: "Payment confirmed", out_for_delivery: "Out for delivery", dispatched: "Out for delivery", delivery_failed: "Delivery failed", completed: "Completed", delivered: "Completed", cancelled: "Cancelled", unable_to_fulfill: "Unable to fulfill", pending: "Awaiting verification", approved: "Approved", rejected: "Rejected", confirmed: "Confirmed" };
  return labels[status] || String(status || "").replaceAll("_", " ");
}

function quoteTotals(data) {
  const minor = (value) => Math.max(0, Math.round(Number(value || 0) * 100));
  const items = (data.items || []).map((item) => {
    const quantity = Math.max(0, Number(item.quotedQuantity || 0));
    const unitPriceMinor = item.availability === "unavailable" ? 0 : minor(item.unitPrice);
    return { ...item, unitPriceMinor, lineTotalMinor: Math.round(quantity * unitPriceMinor) };
  });
  const subtotalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const deliveryFeeMinor = minor(data.deliveryFee);
  const serviceFeeMinor = minor(data.serviceFee);
  const discountMinor = minor(data.discount);
  const taxMinor = minor(data.tax);
  return { ...data, items, subtotalMinor, deliveryFeeMinor, serviceFeeMinor, discountMinor, taxMinor, grandTotalMinor: Math.max(0, subtotalMinor + deliveryFeeMinor + serviceFeeMinor + taxMinor - discountMinor) };
}

function beneficiaryFromRow(row) {
  return { ...row.data, id: row.id, publicId: row.id, archived: row.archived, createdAt: row.created_at, updatedAt: row.updated_at };
}

function requestFromRow(row) {
  const history = row.status_history || [];
  const data = row.data || {};
  const terminal = ["delivered", "completed", "cancelled", "unable_to_fulfill"].includes(row.status);
  const updatedAt = new Date(row.updated_at || row.created_at).getTime();
  const profileCurrency = row.customer_profile?.currency || normalizedCountryProfile(row.customer_profile)?.currency || "USD";
  return { ...data, id: row.id, publicId: row.id, requestNumber: row.request_number, status: row.status, statusLabel: statusLabel(row.status), currency: profileCurrency, beneficiary: row.beneficiary_data ? { ...row.beneficiary_data, id: row.beneficiary_id } : undefined, beneficiaryName: row.beneficiary_data?.fullName, customer: row.customer_email ? { email: row.customer_email, fullName: row.customer_name, country: row.customer_profile?.countryName || row.customer_profile?.country, currency: profileCurrency } : undefined, customerName: row.customer_name, submittedAt: row.created_at, createdAt: row.created_at, updatedAt: row.updated_at, statusHistory: history, internalNotes: row.internal_notes || [], customerMessages: row.customer_messages || [], medicationCount: data.medications?.length || 0, actionRequired: ["quote_ready", "awaiting_payment", "awaiting_information", "additional_information_required"].includes(row.status), urgent: Boolean(data.urgent), overdue: !terminal && Number.isFinite(updatedAt) && Date.now() - updatedAt > 24 * 60 * 60 * 1000, latestUpdate: history.at(-1)?.note, quote: row.quote_id ? { id: row.quote_id, status: row.quote_status } : undefined, order: row.order_id ? { id: row.order_id, publicId: row.order_id } : undefined, orderPath: row.order_id ? `/dashboard/orders/${row.order_id}` : undefined };
}

function customerRequestFromRow(row) {
  const request = row.request_number ? requestFromRow(row) : { ...row };
  const internalStatus = request.status;
  const terminalStatus = ["cancelled", "unable_to_fulfill"].includes(internalStatus) ? internalStatus : null;
  const stage = request.order ? "delivery" : ["quote_ready", "awaiting_payment", "payment_verification", "paid", "payment_confirmed"].includes(internalStatus) ? "payment" : internalStatus === "submitted" ? "request_submitted" : "pharmacy_review";
  const stageLabels = { request_submitted: "Request submitted", pharmacy_review: "Pharmacy review", payment: "Payment", delivery: "Delivery", cancelled: "Cancelled", unable_to_fulfill: "Unable to fulfill" };
  const importantStatuses = new Set(["submitted", "quote_ready", "awaiting_payment", "paid", "payment_confirmed", "out_for_delivery", "delivery_failed", "delivered", "completed", "cancelled", "unable_to_fulfill", "awaiting_information", "additional_information_required"]);
  const statusHistory = (request.statusHistory || []).filter((event) => importantStatuses.has(event.status));
  const paymentState = internalStatus === "awaiting_payment" ? "required" : internalStatus === "payment_verification" ? "verification" : ["paid", "payment_confirmed"].includes(internalStatus) ? "confirmed" : request.quote?.status === "sent" ? "quote_available" : undefined;
  delete request.internalNotes;
  request.status = terminalStatus || stage;
  request.statusLabel = stageLabels[request.status];
  request.trackerStage = stage;
  request.paymentState = paymentState;
  request.completed = ["completed", "delivered"].includes(internalStatus);
  request.statusHistory = statusHistory;
  request.latestUpdate = statusHistory.at(-1)?.note || (stage === "pharmacy_review" ? "The pharmacy is reviewing this request." : stageLabels[stage]);
  return request;
}

async function getRequestRow(id, ownerId) {
  const rows = ownerId
    ? await sql`SELECT r.*, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, p.profile customer_profile, q.id quote_id, q.status quote_status, o.id order_id FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=r.owner_user_id LEFT JOIN quotes q ON q.request_id=r.id LEFT JOIN orders o ON o.request_id=r.id WHERE r.id=${id} AND r.owner_user_id=${ownerId}`
    : await sql`SELECT r.*, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, p.profile customer_profile, q.id quote_id, q.status quote_status, o.id order_id FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=r.owner_user_id LEFT JOIN quotes q ON q.request_id=r.id LEFT JOIN orders o ON o.request_id=r.id WHERE r.id=${id}`;
  return rows[0];
}

function parseDataUrl(receipt) {
  const match = String(receipt?.dataUrl || "").match(/^data:(image\/jpeg|image\/png|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error("Use a valid JPG, PNG, or PDF receipt."), { status: 400 });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 2.5 * 1024 * 1024) throw Object.assign(new Error("The receipt must be 2.5 MB or smaller."), { status: 400 });
  const signatures = {
    "application/pdf": bytes.subarray(0, 5).toString("ascii") === "%PDF-",
    "image/png": bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/jpeg": bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  };
  if (!signatures[match[1]]) throw Object.assign(new Error("The uploaded file content does not match its declared type."), { status: 400 });
  return { contentType: match[1], bytes };
}

function safeFilename(name, contentType) {
  const ext = contentType === "application/pdf" ? ".pdf" : contentType === "image/png" ? ".png" : ".jpg";
  return `${String(name || "receipt").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80).replace(/\.(pdf|png|jpe?g)$/i, "")}${ext}`;
}

async function streamPrivateBlob(res, url, contentType, fileName) {
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200) return fail(res, 404, "File not found.");
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType || result.blob.contentType || "application/octet-stream");
  const disposition = contentType === "application/pdf" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename="${String(fileName).replace(/["\r\n]/g, "")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  for await (const chunk of result.stream) res.write(chunk);
  res.end();
}

async function audit(actorId, eventType, targetType, targetId, metadata = {}) {
  await sql`INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, metadata) VALUES (${randomUUID()}, ${actorId}, ${eventType}, ${targetType}, ${targetId}, ${JSON.stringify(metadata)}::jsonb)`;
}

function hasRole(user, allowedRoles) {
  return user.roles.some((role) => allowedRoles.includes(role));
}

function requireRole(user, res, allowedRoles) {
  if (hasRole(user, allowedRoles)) return true;
  fail(res, 403, "You do not have permission to perform this action.");
  return false;
}

async function notify(ownerUserId, title, message, actionPath, actionLabel) {
  await sql`INSERT INTO notifications (id, owner_user_id, title, message, action_path, action_label)
    VALUES (${randomUUID()}, ${ownerUserId}, ${title}, ${message}, ${actionPath || null}, ${actionLabel || null})`;
}

function notificationFromRow(row) {
  return { id: row.id, publicId: row.id, title: row.title, message: row.message, actionPath: row.action_path, actionLabel: row.action_label, readAt: row.read_at, createdAt: row.created_at };
}

function orderFromRow(row) {
  const data = row.data || {};
  const beneficiary = row.beneficiary_data || {};
  const rawItems = data.items?.length ? data.items : row.request_data?.medications || [];
  const items = rawItems.map((item) => ({ ...item, quantity: item.quantity ?? item.quotedQuantity, fulfillmentStatusLabel: item.fulfillmentStatusLabel || "Pending" }));
  const statusHistory = data.statusHistory || [{ id: `created-${row.id}`, status: "payment_confirmed", customerLabel: "Payment confirmed", createdAt: row.created_at }];
  const delivery = data.delivery || { address: beneficiary.deliveryAddress, instructions: beneficiary.deliveryInstructions };
  if (data.deliveryProofReference) delivery.proofViewUrl = `/api/v1/orders/${row.id}/delivery-proof`;
  return {
    ...data,
    id: row.id,
    publicId: row.id,
    orderNumber: row.order_number,
    requestId: row.request_id,
    requestNumber: row.request_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    beneficiary: { ...beneficiary, id: row.beneficiary_id },
    beneficiaryName: beneficiary.fullName,
    payment: { id: row.payment_id, paymentNumber: row.payment_number, paidAt: row.paid_at },
    status: row.status,
    statusLabel: statusLabel(row.status),
    amountMinor: row.amount_minor,
    currency: row.currency,
    items,
    itemCount: items.length,
    delivery,
    deliveryStatusLabel: data.deliveryStatusLabel || (["out_for_delivery", "delivered", "delivery_failed"].includes(row.status) ? statusLabel(row.status) : "Not dispatched"),
    internalTimeline: data.internalTimeline || [],
    statusHistory,
    timeline: statusHistory,
    customerStatusNote: statusHistory.at(-1)?.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function customerOrderFromRow(row) {
  const order = row.order_number ? orderFromRow(row) : { ...row };
  const deliveryState = order.status === "delivery_failed" ? "delivery_failed" : ["completed", "delivered"].includes(order.status) ? "completed" : order.status === "out_for_delivery" ? "out_for_delivery" : "payment_confirmed";
  const labels = { payment_confirmed: "Payment confirmed", out_for_delivery: "Out for delivery", completed: "Completed", delivery_failed: "Delivery failed" };
  const important = new Set(["payment_confirmed", "out_for_delivery", "delivery_failed", "delivered", "completed"]);
  const seen = new Set();
  const timeline = (order.statusHistory || []).filter((event) => important.has(event.status)).map((event) => {
    const status = event.status === "delivered" ? "completed" : event.status;
    return { id: event.id, status, customerLabel: labels[status], note: event.note, createdAt: event.createdAt || event.timestamp };
  }).filter((event) => !seen.has(event.status) && seen.add(event.status));
  order.status = deliveryState;
  order.statusLabel = labels[deliveryState];
  order.deliveryStatusLabel = labels[deliveryState];
  order.timeline = timeline;
  order.statusHistory = timeline;
  order.customerStatusNote = timeline.at(-1)?.note;
  delete order.internalTimeline;
  delete order.deliveryAssignment;
  return order;
}

function staffOrderFromRow(row, user) {
  const order = orderFromRow(row);
  const clinical = hasRole(user, ["admin", "pharmacist"]);
  if (!clinical) {
    const beneficiary = order.beneficiary || {};
    order.beneficiary = {
      id: beneficiary.id,
      fullName: beneficiary.fullName,
      phone: beneficiary.phone,
      alternativePhone: beneficiary.alternativePhone,
      deliveryAddress: beneficiary.deliveryAddress,
      deliveryInstructions: beneficiary.deliveryInstructions,
      city: beneficiary.city,
    };
    delete order.customerEmail;
  }
  if (!clinical && hasRole(user, ["delivery_operations"]) && !hasRole(user, ["fulfillment"])) {
    order.items = [];
    order.itemCount = 0;
  }
  return order;
}

function staffRequestFromRow(row, user) {
  const request = requestFromRow(row);
  if (hasRole(user, ["admin", "pharmacist"])) return request;
  const beneficiary = request.beneficiary || {};
  request.beneficiary = {
    id: beneficiary.id,
    fullName: beneficiary.fullName,
    phone: beneficiary.phone,
    alternativePhone: beneficiary.alternativePhone,
    contactConsent: beneficiary.contactConsent,
    deliveryAddress: beneficiary.deliveryAddress,
    city: beneficiary.city,
  };
  request.beneficiaryName = beneficiary.fullName;
  request.medications = [];
  request.description = "Restricted to pharmacy roles";
  request.fileReferences = [];
  return request;
}

async function getOrderRow(id, ownerId) {
  const rows = ownerId
    ? await sql`SELECT o.*, r.request_number, r.data request_data, b.id beneficiary_id, b.data beneficiary_data, p.payment_number, p.paid_at, p.amount_minor, p.currency, ap.email customer_email, ap.full_name customer_name FROM orders o JOIN medication_requests r ON r.id=o.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN payments p ON p.id=o.payment_id JOIN app_profiles ap ON ap.user_id=o.owner_user_id WHERE o.id=${id} AND o.owner_user_id=${ownerId}`
    : await sql`SELECT o.*, r.request_number, r.data request_data, b.id beneficiary_id, b.data beneficiary_data, p.payment_number, p.paid_at, p.amount_minor, p.currency, ap.email customer_email, ap.full_name customer_name FROM orders o JOIN medication_requests r ON r.id=o.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN payments p ON p.id=o.payment_id JOIN app_profiles ap ON ap.user_id=o.owner_user_id WHERE o.id=${id}`;
  return rows[0];
}

async function saveOrderState(row, nextStatus, data, actorId, eventType, customerTitle, customerMessage) {
  const now = new Date().toISOString();
  const ownerId = row.owner_user_id;
  await sql`UPDATE orders SET status=${nextStatus}, data=${JSON.stringify(data)}::jsonb, updated_at=now() WHERE id=${row.id}`;
  await audit(actorId, eventType, "order", row.id, { ownerId, status: nextStatus });
  if (customerTitle) await notify(ownerId, customerTitle, customerMessage || statusLabel(nextStatus), `/dashboard/orders/${row.id}`, "View order");
  return now;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const routedPath = url.searchParams.get("path");
    const path = (routedPath || url.pathname.replace(/^\/api\/v1\/?/, "")).split("/").filter(Boolean).map(decodeURIComponent);
    if (path[0] === "health") return send(res, 200, { ok: true, database: Boolean(connectionString), auth: Boolean(authBaseUrl()), privateStorage: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) });
    if (path[0] === "auth") return handleAuth(req, res, path[1]);
    await ensureSchema();
    const isAdminPath = path[0] === "admin";
    const user = await requireUser(req, res, isAdminPath ? ["admin", "pharmacist", "customer_support", "fulfillment", "delivery_operations"] : undefined);
    if (!user) return;

    if (path[0] === "profile" && path.length === 1) {
      if (req.method === "GET") return send(res, 200, { user });
      if (req.method === "PUT") {
        const body = await readJson(req);
        const firstName = String(body.firstName || "").trim();
        const lastName = String(body.lastName || "").trim();
        const phone = String(body.phone || "").trim();
        const countryProfile = normalizedCountryProfile(body.countryCode || body.country);
        if (!firstName || !lastName || !phone || !countryProfile) return fail(res, 400, "Enter your name and phone, then choose a valid country.");
        const profile = { ...(user.profile || {}), firstName, lastName, phone, ...countryProfile };
        if (body.legalAccepted === true && !profile.legalAcceptedAt) Object.assign(profile, { legalAcceptedAt: new Date().toISOString(), termsVersion: "2026-08-02", privacyVersion: "2026-08-02" });
        const fullName = `${firstName} ${lastName}`.trim();
        await sql`UPDATE app_profiles SET full_name=${fullName}, profile=${JSON.stringify(profile)}::jsonb, updated_at=now() WHERE user_id=${user.id}`;
        await audit(user.id, "profile.updated", "app_profile", user.id, { countryCode: countryProfile.countryCode, currency: countryProfile.currency });
        return send(res, 200, { user: { ...user, name: fullName, profile } });
      }
      return fail(res, 405, "Method not allowed.");
    }

    if (path[0] === "beneficiaries") {
      if (req.method === "GET" && path.length === 1) {
        const includeArchived = url.searchParams.get("includeArchived") === "true";
        const rows = includeArchived ? await sql`SELECT * FROM beneficiaries WHERE owner_user_id=${user.id} ORDER BY created_at DESC` : await sql`SELECT * FROM beneficiaries WHERE owner_user_id=${user.id} AND archived=false ORDER BY created_at DESC`;
        return send(res, 200, { beneficiaries: rows.map(beneficiaryFromRow) });
      }
      if (req.method === "POST" && path.length === 1) {
        const data = await readJson(req);
        if (!data.fullName || !data.phone || !data.city || !data.deliveryAddress || !data.contactConsent) return fail(res, 400, "Complete the required beneficiary details.");
        const id = randomUUID();
        await sql`INSERT INTO beneficiaries (id, owner_user_id, data) VALUES (${id}, ${user.id}, ${JSON.stringify(data)}::jsonb)`;
        return send(res, 201, { beneficiary: { ...data, id, publicId: id } });
      }
      const id = path[1];
      const rows = await sql`SELECT * FROM beneficiaries WHERE id=${id} AND owner_user_id=${user.id}`;
      if (!rows[0]) return fail(res, 404, "Beneficiary not found.");
      if (req.method === "GET" && path.length === 2) return send(res, 200, { beneficiary: beneficiaryFromRow(rows[0]) });
      if (req.method === "PATCH" && path.length === 2) {
        const data = await readJson(req);
        if (!data.fullName || !data.phone || !data.city || !data.deliveryAddress || !data.contactConsent) return fail(res, 400, "Complete the required beneficiary details.");
        await sql`UPDATE beneficiaries SET data=${JSON.stringify(data)}::jsonb, updated_at=now() WHERE id=${id}`;
        return send(res, 200, { beneficiary: { ...data, id, publicId: id } });
      }
      if (req.method === "POST" && path[2] === "archive") {
        await sql`UPDATE beneficiaries SET archived=true, updated_at=now() WHERE id=${id}`;
        return send(res, 200, { ok: true });
      }
    }

    if (path[0] === "request-files" && req.method === "POST" && path.length === 1) {
      const body = await readJson(req);
      const parsed = parseDataUrl(body);
      const id = randomUUID();
      const fileName = safeFilename(body.fileName, parsed.contentType);
      const blob = await put(`requests/${user.id}/${id}/${fileName}`, parsed.bytes, { access: "private", contentType: parsed.contentType, addRandomSuffix: false });
      await sql`INSERT INTO protected_files (id, owner_user_id, kind, blob_url, pathname, file_name, content_type, size_bytes) VALUES (${id}, ${user.id}, 'request', ${blob.url}, ${blob.pathname}, ${fileName}, ${parsed.contentType}, ${parsed.bytes.length})`;
      return send(res, 201, { id, fileReference: id, fileName });
    }

    if (path[0] === "medication-requests") {
      if (req.method === "GET" && path.length === 1) {
        const rows = await sql`SELECT r.*, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, p.profile customer_profile, q.id quote_id, q.status quote_status, o.id order_id FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=r.owner_user_id LEFT JOIN quotes q ON q.request_id=r.id LEFT JOIN orders o ON o.request_id=r.id WHERE r.owner_user_id=${user.id} ORDER BY r.created_at DESC`;
        let requests = rows.map(requestFromRow);
        const status = url.searchParams.get("status");
        const search = String(url.searchParams.get("search") || "").toLowerCase();
        if (status && status !== "all") requests = requests.filter((item) => status === "active" ? !["delivered", "completed", "cancelled", "unable_to_fulfill"].includes(item.status) : status === "needs_action" ? item.actionRequired : status === "completed" ? ["delivered", "completed"].includes(item.status) : item.status === status);
        if (search) requests = requests.filter((item) => JSON.stringify(item).toLowerCase().includes(search));
        return send(res, 200, { requests: requests.map((request) => customerRequestFromRow(request)) });
      }
      if (req.method === "POST" && path.length === 1) {
        const data = await readJson(req);
        const method = String(data.submissionMethod || data.method || "");
        const beneficiaries = await sql`SELECT id FROM beneficiaries WHERE id=${data.beneficiaryId} AND owner_user_id=${user.id} AND archived=false`;
        if (!beneficiaries[0] || !data.accuracyConfirmed) return fail(res, 400, "Select a valid beneficiary and confirm the request details.");
        if (!["prescription", "medications", "description", "contact"].includes(method)) return fail(res, 400, "Choose a valid request method.");
        if (method === "medications" && (!Array.isArray(data.medications) || !data.medications.length || data.medications.some((item) => !String(item.medicationName || "").trim() || !String(item.quantity || "").trim()))) return fail(res, 400, "Enter a medication name and quantity for every item.");
        if (method === "description" && String(data.description || "").trim().length < 10) return fail(res, 400, "Describe what the beneficiary needs.");
        const fileReferences = (data.fileReferences || []).map((item) => typeof item === "string" ? item : item.fileReference).filter(Boolean);
        if (method === "prescription" && !fileReferences.length) return fail(res, 400, "Upload at least one prescription file.");
        if (fileReferences.length) {
          const ownedFiles = await sql`SELECT id FROM protected_files WHERE owner_user_id=${user.id} AND kind='request' AND id = ANY(${fileReferences})`;
          if (ownedFiles.length !== new Set(fileReferences).size) return fail(res, 400, "One or more request files are invalid.");
        }
        const id = randomUUID();
        const requestNumber = numberCode("HPR");
        const history = [{ id: randomUUID(), status: "submitted", customerLabel: "Request submitted", note: "Hakim Plus received the medication request.", createdAt: new Date().toISOString() }];
        const requestData = { ...data, submissionMethod: method };
        await sql`INSERT INTO medication_requests (id, owner_user_id, beneficiary_id, request_number, data, status_history) VALUES (${id}, ${user.id}, ${data.beneficiaryId}, ${requestNumber}, ${JSON.stringify(requestData)}::jsonb, ${JSON.stringify(history)}::jsonb)`;
        if (fileReferences.length) await sql`UPDATE protected_files SET target_id=${id} WHERE owner_user_id=${user.id} AND kind='request' AND id = ANY(${fileReferences})`;
        await audit(user.id, "request.created", "medication_request", id, { ownerId: user.id });
        await notify(user.id, "Request submitted", "Hakim Plus received your medication request and the pharmacy will review it.", `/dashboard/requests/${id}`, "View request");
        const row = await getRequestRow(id, user.id);
        return send(res, 201, { request: customerRequestFromRow(row) });
      }
      const requestId = path[1];
      if (req.method === "GET" && path.length === 2) {
        const row = await getRequestRow(requestId, user.id);
        if (!row) return fail(res, 404, "Medication request not found.");
        return send(res, 200, { request: customerRequestFromRow(row) });
      }
      if (path[2] === "message-attachments" && req.method === "POST" && path.length === 3) {
        const row = await getRequestRow(requestId, user.id);
        if (!row) return fail(res, 404, "Medication request not found.");
        const body = await readJson(req);
        const parsed = parseDataUrl(body);
        const id = randomUUID();
        const fileName = safeFilename(body.fileName, parsed.contentType);
        const blob = await put(`messages/${user.id}/${requestId}/${id}/${fileName}`, parsed.bytes, { access: "private", contentType: parsed.contentType, addRandomSuffix: false });
        await sql`INSERT INTO protected_files (id, owner_user_id, kind, target_id, blob_url, pathname, file_name, content_type, size_bytes) VALUES (${id}, ${user.id}, 'message', ${requestId}, ${blob.url}, ${blob.pathname}, ${fileName}, ${parsed.contentType}, ${parsed.bytes.length})`;
        return send(res, 201, { id, fileReference: id, fileName });
      }
      if (path[2] === "message-attachments" && req.method === "GET" && path.length === 4) {
        const row = await getRequestRow(requestId, user.id);
        if (!row) return fail(res, 404, "Medication request not found.");
        const files = await sql`SELECT * FROM protected_files WHERE id=${path[3]} AND owner_user_id=${user.id} AND kind='message' AND target_id=${requestId}`;
        if (!files[0]) return fail(res, 404, "Message attachment not found.");
        await audit(user.id, "message_attachment.viewed", "protected_file", path[3], { ownerId: user.id, requestId });
        return streamPrivateBlob(res, files[0].blob_url, files[0].content_type, files[0].file_name);
      }
      if (path[2] === "messages") {
        const row = await getRequestRow(requestId, user.id);
        if (!row) return fail(res, 404, "Medication request not found.");
        if (req.method === "GET") {
          const messages = (row.customer_messages || []).map((message) => ({
            ...message,
            senderType: message.senderType || (message.author?.name === "Customer" ? "customer" : "staff"),
            senderName: message.senderName || message.author?.name || "Hakim Plus Pharmacy",
            attachments: (message.attachments || []).map((attachment) => ({ ...attachment, viewUrl: `/api/v1/medication-requests/${requestId}/message-attachments/${attachment.fileReference || attachment.id}` })),
          }));
          return send(res, 200, { request: { id: requestId, requestNumber: row.request_number }, messages, nextCursor: "" });
        }
        if (req.method === "POST") {
          const body = await readJson(req);
          const messageText = String(body.message || "").trim();
          const attachmentReferences = (body.fileReferences || body.attachments || []).map((item) => typeof item === "string" ? item : item.fileReference).filter(Boolean);
          if (!messageText && !attachmentReferences.length) return fail(res, 400, "Enter a message or attach a file.");
          let attachments = [];
          if (attachmentReferences.length) {
            const files = await sql`SELECT id, file_name FROM protected_files WHERE owner_user_id=${user.id} AND kind='message' AND target_id=${requestId} AND id = ANY(${attachmentReferences})`;
            if (files.length !== new Set(attachmentReferences).size) return fail(res, 400, "One or more message attachments are invalid.");
            attachments = files.map((file) => ({ id: file.id, fileReference: file.id, fileName: file.file_name }));
          }
          const item = { id: randomUUID(), senderType: "customer", senderName: user.name || "Customer", message: messageText, attachments, createdAt: new Date().toISOString() };
          const nextStatus = ["awaiting_information", "additional_information_required"].includes(row.status) ? "under_review" : row.status;
          await sql`UPDATE medication_requests SET status=${nextStatus}, customer_messages=customer_messages || ${JSON.stringify([item])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          await audit(user.id, "customer_message.sent", "medication_request", requestId, { ownerId: user.id });
          return send(res, 201, { message: { ...item, attachments: attachments.map((attachment) => ({ ...attachment, viewUrl: `/api/v1/medication-requests/${requestId}/message-attachments/${attachment.id}` })) } });
        }
      }
      if (req.method === "GET" && path[2] === "quote") {
        const rows = await sql`SELECT q.* FROM quotes q JOIN medication_requests r ON r.id=q.request_id WHERE r.id=${requestId} AND r.owner_user_id=${user.id} AND q.status <> 'draft'`;
        if (!rows[0]) return fail(res, 404, "A customer-visible quote is not available yet.");
        return send(res, 200, { quote: { ...quoteTotals(rows[0].data), id: rows[0].id, publicId: rows[0].id, quoteNumber: rows[0].quote_number, status: rows[0].status, sentAt: rows[0].sent_at } });
      }
      if (req.method === "GET" && path[2] === "payment") {
        const rows = await sql`SELECT r.request_number, r.status request_status, b.data beneficiary_data, q.* FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN quotes q ON q.request_id=r.id WHERE r.id=${requestId} AND r.owner_user_id=${user.id} AND q.status='approved'`;
        if (!rows[0]) return fail(res, 409, "Approve the current quote before submitting payment.");
        const quote = { ...quoteTotals(rows[0].data), id: rows[0].id, quoteNumber: rows[0].quote_number };
        return send(res, 200, { paymentContext: { requestId, requestNumber: rows[0].request_number, beneficiaryName: rows[0].beneficiary_data.fullName, quote, bankTransfer: BANK } });
      }
      if (req.method === "POST" && path[2] === "bank-transfer") {
        const body = await readJson(req);
        const parsed = parseDataUrl(body.receipt);
        const rows = await sql`SELECT q.*, r.request_number FROM quotes q JOIN medication_requests r ON r.id=q.request_id WHERE r.id=${requestId} AND r.owner_user_id=${user.id} AND q.status='approved'`;
        if (!rows[0]) return fail(res, 409, "This request does not have an approved quote.");
        const open = await sql`SELECT id FROM bank_transfers WHERE request_id=${requestId} AND status IN ('pending','approved')`;
        if (open[0]) return fail(res, 409, "A transfer is already awaiting review or has been approved for this request.");
        const id = randomUUID();
        const fileName = safeFilename(body.receipt.fileName, parsed.contentType);
        const blob = await put(`receipts/${user.id}/${requestId}/${id}/${fileName}`, parsed.bytes, { access: "private", contentType: parsed.contentType, addRandomSuffix: false });
        const quote = quoteTotals(rows[0].data);
        const transferNumber = numberCode("TRF");
        await sql`INSERT INTO bank_transfers (id, request_id, quote_id, owner_user_id, transfer_number, amount_minor, currency, transfer_reference, transfer_date, blob_url, pathname, file_name, content_type) VALUES (${id}, ${requestId}, ${rows[0].id}, ${user.id}, ${transferNumber}, ${quote.grandTotalMinor}, ${quote.currency || 'ETB'}, ${String(body.transferReference || '').slice(0, 120)}, ${body.transferDate || null}, ${blob.url}, ${blob.pathname}, ${fileName}, ${parsed.contentType})`;
        await sql`UPDATE medication_requests SET status='payment_verification', updated_at=now() WHERE id=${requestId}`;
        await audit(user.id, "bank_transfer.submitted", "bank_transfer", id, { ownerId: user.id, requestId });
        return send(res, 201, { transfer: { id, transferNumber, status: "pending" } });
      }
    }

    if (path[0] === "quotes" && req.method === "POST") {
      const quoteId = path[1];
      const rows = await sql`SELECT q.*, r.id request_id, r.owner_user_id FROM quotes q JOIN medication_requests r ON r.id=q.request_id WHERE q.id=${quoteId} AND r.owner_user_id=${user.id}`;
      if (!rows[0]) return fail(res, 404, "Quote not found.");
      if (path[2] === "approve") {
        if (!rows[0].data?.expiresAt || new Date(rows[0].data.expiresAt).getTime() <= Date.now()) return fail(res, 409, "This quote has expired. Ask Hakim Plus for an updated quote.");
        const updated = await sql`UPDATE quotes SET status='approved', approved_at=now(), updated_at=now() WHERE id=${quoteId} AND status='sent' RETURNING id`;
        if (!updated[0]) return fail(res, 409, "Only the current sent quote can be approved.");
        const paymentEvent = { id: randomUUID(), status: "awaiting_payment", customerLabel: "Payment required", note: "Your quote is approved and payment is required.", createdAt: new Date().toISOString() };
        await sql`UPDATE medication_requests SET status='awaiting_payment', status_history=status_history || ${JSON.stringify([paymentEvent])}::jsonb, updated_at=now() WHERE id=${rows[0].request_id}`;
        await audit(user.id, "quote.approved", "quote", quoteId, { ownerId: user.id, requestId: rows[0].request_id });
        await notify(user.id, "Payment required", "Your quote is approved. Complete the bank transfer and upload the receipt.", `/dashboard/requests/${rows[0].request_id}/payment`, "Pay now");
        return send(res, 200, { quote: { id: quoteId, status: "approved" }, paymentPath: `/dashboard/requests/${rows[0].request_id}/payment` });
      }
      const body = await readJson(req);
      if (path[2] === "request-change") {
        const message = String(body.message || "").trim();
        if (!message) return fail(res, 400, "Explain what should be changed.");
        const updated = await sql`UPDATE quotes SET status='change_requested', updated_at=now() WHERE id=${quoteId} AND status='sent' RETURNING id`;
        if (!updated[0]) return fail(res, 409, "Only the current sent quote can be changed.");
        const item = { id: randomUUID(), senderType: "customer", senderName: user.name || "Customer", message, createdAt: new Date().toISOString() };
        const event = { id: randomUUID(), status: "under_review", customerLabel: "Changes requested", note: message, createdAt: item.createdAt };
        await sql`UPDATE medication_requests SET status='under_review', status_history=status_history || ${JSON.stringify([event])}::jsonb, customer_messages=customer_messages || ${JSON.stringify([item])}::jsonb, updated_at=now() WHERE id=${rows[0].request_id}`;
        await audit(user.id, "quote.change_requested", "quote", quoteId, { ownerId: user.id, requestId: rows[0].request_id });
        return send(res, 200, { ok: true });
      }
      if (path[2] === "decline") {
        const reason = String(body.reason || "").trim();
        if (!reason) return fail(res, 400, "A decline reason is required.");
        const updated = await sql`UPDATE quotes SET status='declined', updated_at=now() WHERE id=${quoteId} AND status='sent' RETURNING id`;
        if (!updated[0]) return fail(res, 409, "Only the current sent quote can be declined.");
        const event = { id: randomUUID(), status: "cancelled", customerLabel: "Request cancelled", note: reason, createdAt: new Date().toISOString() };
        await sql`UPDATE medication_requests SET status='cancelled', status_history=status_history || ${JSON.stringify([event])}::jsonb, updated_at=now() WHERE id=${rows[0].request_id}`;
        await audit(user.id, "quote.declined", "quote", quoteId, { ownerId: user.id, requestId: rows[0].request_id });
        return send(res, 200, { ok: true });
      }
    }

    if (path[0] === "payments") {
      if (req.method === "GET" && path.length === 1) {
        const transfers = await sql`SELECT t.*, r.request_number, p.id payment_id, p.payment_number, p.paid_at FROM bank_transfers t JOIN medication_requests r ON r.id=t.request_id LEFT JOIN payments p ON p.transfer_id=t.id WHERE t.owner_user_id=${user.id} ORDER BY t.created_at DESC`;
        return send(res, 200, { payments: transfers.map((row) => ({ id: row.payment_id || row.id, transferNumber: row.transfer_number, paymentNumber: row.payment_number || row.transfer_number, requestNumber: row.request_number, amountMinor: row.amount_minor, currency: row.currency, status: row.status === "approved" ? "confirmed" : row.status, statusLabel: row.status === "approved" ? "Verified" : statusLabel(row.status), createdAt: row.created_at, receiptAvailable: Boolean(row.payment_id), rejectionReason: row.rejection_reason })) });
      }
      const paymentId = path[1];
      const rows = await sql`SELECT p.*, r.request_number, b.data beneficiary_data FROM payments p JOIN medication_requests r ON r.id=p.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id WHERE p.id=${paymentId} AND p.owner_user_id=${user.id}`;
      if (!rows[0]) return fail(res, 404, "Verified payment not found.");
      const receipt = { receiptNumber: `RCT-${rows[0].payment_number}`, paymentNumber: rows[0].payment_number, requestNumber: rows[0].request_number, beneficiaryName: rows[0].beneficiary_data.fullName, amountMinor: rows[0].amount_minor, currency: rows[0].currency, paidAt: rows[0].paid_at, paymentMethodLabel: "Bank transfer" };
      if (req.method === "GET" && path[2] === "receipt") return send(res, 200, { receipt });
      if (req.method === "GET") return send(res, 200, { payment: { ...receipt, id: paymentId, status: "confirmed" } });
    }

    if (path[0] === "orders") {
      if (req.method === "GET" && path.length === 1) {
        const rows = await sql`SELECT o.*, r.request_number, r.data request_data, b.id beneficiary_id, b.data beneficiary_data, p.payment_number, p.paid_at, p.amount_minor, p.currency, ap.email customer_email, ap.full_name customer_name FROM orders o JOIN medication_requests r ON r.id=o.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN payments p ON p.id=o.payment_id JOIN app_profiles ap ON ap.user_id=o.owner_user_id WHERE o.owner_user_id=${user.id} ORDER BY o.created_at DESC`;
        const view = url.searchParams.get("view") || "active";
        let orders = rows.map(orderFromRow);
        if (view === "active") orders = orders.filter((order) => !["delivered", "completed", "cancelled"].includes(order.status));
        if (["past", "history", "completed"].includes(view)) orders = orders.filter((order) => ["delivered", "completed", "cancelled"].includes(order.status));
        return send(res, 200, { orders: orders.map((order) => customerOrderFromRow(order)) });
      }
      if (req.method === "GET" && path.length === 2) {
        const row = await getOrderRow(path[1], user.id);
        if (!row) return fail(res, 404, "Order not found.");
        return send(res, 200, { order: customerOrderFromRow(row) });
      }
      if (req.method === "GET" && path[2] === "delivery-proof") {
        const row = await getOrderRow(path[1], user.id);
        if (!row) return fail(res, 404, "Order not found.");
        const proofReference = row.data?.deliveryProofReference;
        if (!proofReference) return fail(res, 404, "Delivery proof is not available.");
        const files = await sql`SELECT * FROM protected_files WHERE id=${proofReference} AND kind='delivery' AND target_id=${row.id}`;
        if (!files[0]) return fail(res, 404, "Delivery proof is not available.");
        await audit(user.id, "delivery_proof.viewed", "order", row.id, { ownerId: user.id, fileId: proofReference });
        return streamPrivateBlob(res, files[0].blob_url, files[0].content_type, files[0].file_name);
      }
      if (req.method === "POST" && path[2] === "request-again") {
        const row = await getOrderRow(path[1], user.id);
        if (!row) return fail(res, 404, "Order not found.");
        const beneficiary = await sql`SELECT id FROM beneficiaries WHERE id=${row.beneficiary_id} AND owner_user_id=${user.id} AND archived=false`;
        if (!beneficiary[0]) return fail(res, 409, "Restore or add a beneficiary before requesting these items again.");
        const id = randomUUID();
        const requestNumber = numberCode("HPR");
        const requestData = { ...(row.request_data || {}), beneficiaryId: row.beneficiary_id, accuracyConfirmed: true, urgent: false, additionalNotes: `Requested again from ${row.order_number}.` };
        const history = [{ id: randomUUID(), status: "submitted", customerLabel: "Request submitted", note: `Requested again from ${row.order_number}.`, createdAt: new Date().toISOString() }];
        await sql`INSERT INTO medication_requests (id, owner_user_id, beneficiary_id, request_number, data, status_history) VALUES (${id}, ${user.id}, ${row.beneficiary_id}, ${requestNumber}, ${JSON.stringify(requestData)}::jsonb, ${JSON.stringify(history)}::jsonb)`;
        await audit(user.id, "order.requested_again", "order", row.id, { ownerId: user.id, newRequestId: id });
        await notify(user.id, "Request submitted", "Hakim Plus received your repeat medication request and the pharmacy will review it.", `/dashboard/requests/${id}`, "View request");
        return send(res, 201, { request: { id, publicId: id, requestNumber }, requestPath: `/dashboard/requests/${id}/confirmation` });
      }
    }

    if (path[0] === "admin") {
      if (path[1] === "dashboard" && req.method === "GET") {
        const requestRows = await sql`SELECT status, count(*)::int count FROM medication_requests GROUP BY status`;
        const orderRows = await sql`SELECT status, count(*)::int count FROM orders GROUP BY status`;
        const requestCounts = Object.fromEntries(requestRows.map((row) => [row.status, row.count]));
        const orderCounts = Object.fromEntries(orderRows.map((row) => [row.status, row.count]));
        const urgentRequests = (await sql`SELECT count(*)::int count FROM medication_requests WHERE COALESCE((data->>'urgent')::boolean, false)=true AND status NOT IN ('delivered','completed','cancelled','unable_to_fulfill')`)[0].count;
        const totalOverdue = (await sql`SELECT count(*)::int count FROM medication_requests WHERE updated_at < now() - interval '24 hours' AND status NOT IN ('delivered','completed','cancelled','unable_to_fulfill')`)[0].count;
        return send(res, 200, { metrics: {
          newRequests: requestCounts.submitted || 0,
          awaitingReview: (requestCounts.under_review || 0) + (requestCounts.under_pharmacy_review || 0),
          beneficiaryContact: requestCounts.contacting_beneficiary || 0,
          awaitingQuote: (requestCounts.checking_availability || 0) + (requestCounts.prescription_verification || 0),
          awaitingApproval: requestCounts.quote_ready || 0,
          paymentsReceived: orderCounts.payment_confirmed || 0,
          outForDelivery: orderCounts.out_for_delivery || 0,
          completedOrders: orderCounts.completed || 0,
          deliveryFailed: orderCounts.delivery_failed || 0,
        }, totalOverdue, urgentRequests });
      }
      if (path[1] === "requests") {
        if (!requireRole(user, res, ["admin", "pharmacist", "customer_support"])) return;
        if (req.method === "GET" && path.length === 2) {
          const rows = await sql`SELECT r.*, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, p.profile customer_profile, q.id quote_id, q.status quote_status, o.id order_id FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=r.owner_user_id LEFT JOIN quotes q ON q.request_id=r.id LEFT JOIN orders o ON o.request_id=r.id ORDER BY r.created_at DESC`;
          let requests = rows.map((row) => staffRequestFromRow(row, user));
          const queue = url.searchParams.get("queue");
          const search = String(url.searchParams.get("search") || "").toLowerCase();
          const queueStatuses = {
            new: ["submitted"],
            awaiting_review: ["under_review", "under_pharmacy_review"],
            beneficiary_contact: ["contacting_beneficiary"],
            awaiting_quote: ["checking_availability", "prescription_verification"],
            needs_information: ["awaiting_information", "additional_information_required"],
          };
          if (queueStatuses[queue]) requests = requests.filter((item) => queueStatuses[queue].includes(item.status));
          else if (queue && !["all", "overdue", "urgent"].includes(queue)) requests = requests.filter((item) => item.status === queue);
          if (queue === "urgent") requests = requests.filter((item) => item.urgent);
          if (queue === "overdue") requests = requests.filter((item) => item.overdue);
          if (search) requests = requests.filter((item) => JSON.stringify(item).toLowerCase().includes(search));
          return send(res, 200, { requests });
        }
        const requestId = path[2];
        const row = await getRequestRow(requestId);
        if (!row) return fail(res, 404, "Medication request not found.");
          if (req.method === "GET" && path.length === 3) {
          const request = staffRequestFromRow(row, user);
          if (hasRole(user, ["admin", "pharmacist"])) {
            const refs = (request.fileReferences || []).map((item) => typeof item === "string" ? item : item.fileReference).filter(Boolean);
            const messageRefs = (request.customerMessages || []).flatMap((message) => (message.attachments || []).map((attachment) => attachment.fileReference || attachment.id)).filter(Boolean);
            const requestFiles = refs.length ? await sql`SELECT id, file_name FROM protected_files WHERE kind='request' AND id = ANY(${refs})` : [];
            const messageFiles = messageRefs.length ? await sql`SELECT id, file_name FROM protected_files WHERE kind='message' AND target_id=${requestId} AND id = ANY(${messageRefs})` : [];
            request.files = [
              ...requestFiles.map((file) => ({ id: file.id, fileReference: file.id, fileName: file.file_name, viewUrl: `/api/v1/admin/request-files/${file.id}` })),
              ...messageFiles.map((file) => ({ id: file.id, fileReference: file.id, fileName: file.file_name, viewUrl: `/api/v1/admin/requests/${requestId}/message-attachments/${file.id}` })),
            ];
          }
          return send(res, 200, { request });
        }
        if (req.method === "GET" && path[3] === "message-attachments" && path[4]) {
          if (!requireRole(user, res, ["admin", "pharmacist"])) return;
          const files = await sql`SELECT * FROM protected_files WHERE id=${path[4]} AND kind='message' AND target_id=${requestId}`;
          if (!files[0]) return fail(res, 404, "Message attachment not found.");
          await audit(user.id, "message_attachment.viewed_by_staff", "protected_file", path[4], { ownerId: row.owner_user_id, requestId });
          return streamPrivateBlob(res, files[0].blob_url, files[0].content_type, files[0].file_name);
        }
        if (path[3] === "quote") {
          if (!requireRole(user, res, ["admin", "pharmacist"])) return;
          if (req.method === "GET" && path.length === 4) {
            const rows = await sql`SELECT * FROM quotes WHERE request_id=${requestId}`;
            return send(res, 200, { quote: rows[0] ? { ...quoteTotals(rows[0].data), id: rows[0].id, quoteNumber: rows[0].quote_number, status: rows[0].status, expiresAt: rows[0].data.expiresAt } : null });
          }
          if (req.method === "PUT" && path.length === 4) {
            const data = quoteTotals(await readJson(req));
            const expectedCurrency = row.customer_profile?.currency || normalizedCountryProfile(row.customer_profile)?.currency || "USD";
            data.currency = expectedCurrency;
            if (!Array.isArray(data.items) || !data.items.length) return fail(res, 400, "Add at least one quote item.");
            if (!/^[A-Z]{3}$/.test(String(data.currency || ""))) return fail(res, 400, "Use a valid three-letter currency code.");
            if (!data.expiresAt || !Number.isFinite(new Date(data.expiresAt).getTime()) || new Date(data.expiresAt).getTime() <= Date.now()) return fail(res, 400, "Set a future quote expiration date and time.");
            if (data.items.some((item) => !String(item.medicationName || "").trim() || !["available", "partial", "unavailable"].includes(item.availability) || (item.availability !== "unavailable" && (!(Number(item.quotedQuantity) > 0) || !Number.isInteger(Number(item.quotedQuantity)) || Number(item.unitPrice) < 0)) || (item.availability !== "available" && !String(item.pharmacyNote || "").trim()))) return fail(res, 400, "Complete every quote item, quantity, price, availability, and required note.");
            const existing = await sql`SELECT id, status, data FROM quotes WHERE request_id=${requestId}`;
            const id = existing[0]?.id || randomUUID();
            if (existing[0] && !["draft", "change_requested"].includes(existing[0].status) && !(existing[0].status === "sent" && new Date(existing[0].data?.expiresAt).getTime() <= Date.now())) return fail(res, 409, "This quote can no longer be edited.");
            if (existing[0]) await sql`UPDATE quotes SET data=${JSON.stringify(data)}::jsonb, status='draft', updated_at=now() WHERE id=${id}`;
            else await sql`INSERT INTO quotes (id, request_id, quote_number, data) VALUES (${id}, ${requestId}, ${numberCode('Q')}, ${JSON.stringify(data)}::jsonb)`;
            const saved = await sql`SELECT * FROM quotes WHERE id=${id}`;
            return send(res, 200, { quote: { ...saved[0].data, id, quoteNumber: saved[0].quote_number, status: saved[0].status } });
          }
          if (req.method === "POST" && path[4] === "send") {
            const quotes = await sql`SELECT id, status, data FROM quotes WHERE request_id=${requestId}`;
            if (!quotes[0]) return fail(res, 409, "Save the quote before sending it.");
            if (quotes[0].status !== "draft") return fail(res, 409, "Only a saved draft quote can be sent.");
            if (!quotes[0].data?.expiresAt || new Date(quotes[0].data.expiresAt).getTime() <= Date.now()) return fail(res, 409, "Update the quote expiration before sending it.");
            await sql`UPDATE quotes SET status='sent', sent_at=now(), updated_at=now() WHERE request_id=${requestId}`;
            const event = { id: randomUUID(), status: "quote_ready", customerLabel: "Quote ready", note: "Your pharmacy quote is ready to review.", createdAt: new Date().toISOString() };
            await sql`UPDATE medication_requests SET status='quote_ready', status_history=status_history || ${JSON.stringify([event])}::jsonb, updated_at=now() WHERE id=${requestId}`;
            await audit(user.id, "quote.sent", "medication_request", requestId, { ownerId: row.owner_user_id });
            await notify(row.owner_user_id, "Your quote is ready", "Review the itemized pharmacy quote before it expires.", `/dashboard/requests/${requestId}/quote`, "Review quote");
            return send(res, 200, { ok: true });
          }
        }
        if (req.method === "POST" && path[3] === "status") {
          const body = await readJson(req);
          const status = String(body.status || body.nextStatus || "under_pharmacy_review");
          const allowedStatuses = ["under_review", "under_pharmacy_review", "additional_information_required", "contacting_beneficiary", "prescription_verification", "checking_availability"];
          if (!allowedStatuses.includes(status)) return fail(res, 400, "Choose a valid pharmacy status.");
          const event = { id: randomUUID(), status, customerLabel: statusLabel(status), note: body.note || "Status updated by Hakim Plus.", createdAt: new Date().toISOString() };
          await sql`UPDATE medication_requests SET status=${status}, status_history=status_history || ${JSON.stringify([event])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          await audit(user.id, "request.status_updated", "medication_request", requestId, { ownerId: row.owner_user_id, status });
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "internal-notes") {
          const body = await readJson(req);
          const note = String(body.note || "").trim();
          if (!note) return fail(res, 400, "Enter an internal note.");
          const item = { id: randomUUID(), note, author: { name: user.name }, createdAt: new Date().toISOString() };
          await sql`UPDATE medication_requests SET internal_notes=internal_notes || ${JSON.stringify([item])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          await audit(user.id, "request.internal_note_added", "medication_request", requestId, { ownerId: row.owner_user_id });
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "customer-messages") {
          const body = await readJson(req);
          const message = String(body.message || "").trim();
          if (!message) return fail(res, 400, "Enter a customer message.");
          const item = { id: randomUUID(), senderType: "staff", senderName: user.name || "Hakim Plus Pharmacy", message, author: { name: "Hakim Plus" }, createdAt: new Date().toISOString() };
          await sql`UPDATE medication_requests SET customer_messages=customer_messages || ${JSON.stringify([item])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          await audit(user.id, "staff_message.sent", "medication_request", requestId, { ownerId: row.owner_user_id });
          await notify(row.owner_user_id, "New message from Hakim Plus", "A staff member sent an update about your medication request.", `/dashboard/requests/${requestId}/messages`, "Read message");
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && ["cancel", "unable-to-fulfill", "request-information"].includes(path[3])) {
          const status = path[3] === "cancel" ? "cancelled" : path[3] === "unable-to-fulfill" ? "unable_to_fulfill" : "awaiting_information";
          const body = await readJson(req);
          const text = String(path[3] === "request-information" ? body.message : body.reason || "").trim();
          if (!text) return fail(res, 400, path[3] === "request-information" ? "Enter the information the customer should provide." : "A reason is required.");
          const event = { id: randomUUID(), status, customerLabel: statusLabel(status), note: text, createdAt: new Date().toISOString() };
          if (path[3] === "request-information") {
            const message = { id: randomUUID(), senderType: "staff", senderName: user.name || "Hakim Plus Pharmacy", message: text, author: { name: "Hakim Plus" }, createdAt: event.createdAt };
            await sql`UPDATE medication_requests SET status=${status}, status_history=status_history || ${JSON.stringify([event])}::jsonb, customer_messages=customer_messages || ${JSON.stringify([message])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          } else {
            await sql`UPDATE medication_requests SET status=${status}, status_history=status_history || ${JSON.stringify([event])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          }
          await audit(user.id, `request.${path[3]}`, "medication_request", requestId, { ownerId: row.owner_user_id, reason: text.slice(0, 160) });
          await notify(row.owner_user_id, path[3] === "request-information" ? "More information is needed" : "Request status changed", text, `/dashboard/requests/${requestId}`, "View request");
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "beneficiary-contact") {
          const body = await readJson(req);
          const outcome = String(body.outcome || "").trim();
          const note = String(body.note || "").trim();
          if (!outcome) return fail(res, 400, "Choose a contact outcome.");
          if (!row.beneficiary_data?.contactConsent) return fail(res, 409, "Beneficiary contact is not authorized for this request.");
          const item = { id: randomUUID(), note: `Beneficiary contact (${outcome.replaceAll("_", " ")}): ${note || "No note provided."}`, author: { name: user.name }, createdAt: new Date().toISOString(), kind: "beneficiary_contact", outcome };
          await sql`UPDATE medication_requests SET internal_notes=internal_notes || ${JSON.stringify([item])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          await audit(user.id, "beneficiary.contact_recorded", "medication_request", requestId, { ownerId: row.owner_user_id, outcome });
          return send(res, 200, { ok: true });
        }
      }
      if (path[1] === "request-files" && req.method === "GET") {
        if (!requireRole(user, res, ["admin", "pharmacist"])) return;
        const rows = await sql`SELECT * FROM protected_files WHERE id=${path[2]} AND kind='request'`;
        if (!rows[0]) return fail(res, 404, "Protected file not found.");
        await audit(user.id, "protected_file.viewed", "protected_file", path[2]);
        return streamPrivateBlob(res, rows[0].blob_url, rows[0].content_type, rows[0].file_name);
      }
      if (path[1] === "bank-transfers") {
        if (!requireRole(user, res, ["admin", "pharmacist"])) return;
        if (req.method === "GET" && path.length === 2) {
          const rows = await sql`SELECT t.*, r.request_number, b.data beneficiary_data, p.email customer_email, p.full_name customer_name FROM bank_transfers t JOIN medication_requests r ON r.id=t.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=t.owner_user_id ORDER BY t.created_at DESC`;
          const filter = url.searchParams.get("status") || "pending";
          const filtered = filter === "all" ? rows : rows.filter((row) => row.status === filter);
          return send(res, 200, { transfers: filtered.map((row) => ({ id: row.id, transferNumber: row.transfer_number, status: row.status, statusLabel: statusLabel(row.status), amountMinor: row.amount_minor, currency: row.currency, transferReference: row.transfer_reference, transferDate: row.transfer_date, requestNumber: row.request_number, beneficiaryName: row.beneficiary_data.fullName, customerName: row.customer_name, customerEmail: row.customer_email, createdAt: row.created_at, rejectionReason: row.rejection_reason })) });
        }
        const transferId = path[2];
        const rows = await sql`SELECT t.*, q.data quote_data FROM bank_transfers t JOIN quotes q ON q.id=t.quote_id WHERE t.id=${transferId}`;
        if (!rows[0]) return fail(res, 404, "Transfer not found.");
        if (req.method === "GET" && path[3] === "receipt") {
          await audit(user.id, "bank_transfer.receipt_viewed", "bank_transfer", transferId);
          return streamPrivateBlob(res, rows[0].blob_url, rows[0].content_type, rows[0].file_name);
        }
        if (req.method === "POST" && path[3] === "approve") {
          const body = await readJson(req);
          const paymentId = randomUUID();
          const orderId = randomUUID();
          const reviewed = await sql`UPDATE bank_transfers SET status='approved', reviewed_by=${user.id}, review_note=${String(body.note || '')}, reviewed_at=now() WHERE id=${transferId} AND status='pending' RETURNING id`;
          if (!reviewed[0]) return fail(res, 409, "Only a pending transfer can be approved.");
          await sql`INSERT INTO payments (id, transfer_id, request_id, owner_user_id, payment_number, amount_minor, currency) VALUES (${paymentId}, ${transferId}, ${rows[0].request_id}, ${rows[0].owner_user_id}, ${numberCode('PAY')}, ${rows[0].amount_minor}, ${rows[0].currency}) ON CONFLICT (transfer_id) DO NOTHING`;
          const payments = await sql`SELECT id FROM payments WHERE transfer_id=${transferId}`;
          const orderData = { items: rows[0].quote_data?.items || [], statusHistory: [{ id: randomUUID(), status: "payment_confirmed", customerLabel: "Payment confirmed", note: "Your bank transfer was verified.", createdAt: new Date().toISOString() }], internalTimeline: [{ id: randomUUID(), label: "Order created after payment verification", createdAt: new Date().toISOString(), actor: { name: user.name } }] };
          await sql`INSERT INTO orders (id, payment_id, request_id, owner_user_id, order_number, data) VALUES (${orderId}, ${payments[0].id}, ${rows[0].request_id}, ${rows[0].owner_user_id}, ${numberCode('ORD')}, ${JSON.stringify(orderData)}::jsonb) ON CONFLICT (request_id) DO NOTHING`;
          await sql`UPDATE medication_requests SET status='paid', updated_at=now() WHERE id=${rows[0].request_id}`;
          await audit(user.id, "bank_transfer.approved", "bank_transfer", transferId, { ownerId: rows[0].owner_user_id, requestId: rows[0].request_id });
          await notify(rows[0].owner_user_id, "Payment confirmed", "Your bank transfer was verified and the pharmacy order was created.", "/dashboard/orders", "Track order");
          return send(res, 200, { ok: true, paymentId: payments[0].id });
        }
        if (req.method === "POST" && path[3] === "reject") {
          const body = await readJson(req);
          if (!String(body.reason || "").trim()) return fail(res, 400, "A rejection reason is required.");
          const reviewed = await sql`UPDATE bank_transfers SET status='rejected', rejection_reason=${String(body.reason).trim()}, reviewed_by=${user.id}, reviewed_at=now() WHERE id=${transferId} AND status='pending' RETURNING id`;
          if (!reviewed[0]) return fail(res, 409, "Only a pending transfer can be rejected.");
          await sql`UPDATE medication_requests SET status='awaiting_payment', updated_at=now() WHERE id=${rows[0].request_id}`;
          await audit(user.id, "bank_transfer.rejected", "bank_transfer", transferId, { ownerId: rows[0].owner_user_id, requestId: rows[0].request_id });
          await notify(rows[0].owner_user_id, "Transfer receipt needs attention", String(body.reason).trim(), `/dashboard/requests/${rows[0].request_id}/payment`, "Resubmit receipt");
          return send(res, 200, { ok: true });
        }
      }
      if (path[1] === "orders") {
        if (!requireRole(user, res, ["admin", "pharmacist", "fulfillment", "delivery_operations"])) return;
        if (req.method === "GET" && path.length === 2) {
          const rows = await sql`SELECT o.*, r.request_number, r.data request_data, b.id beneficiary_id, b.data beneficiary_data, pay.payment_number, pay.paid_at, pay.amount_minor, pay.currency, ap.email customer_email, ap.full_name customer_name FROM orders o JOIN medication_requests r ON r.id=o.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN payments pay ON pay.id=o.payment_id JOIN app_profiles ap ON ap.user_id=o.owner_user_id ORDER BY o.created_at DESC`;
          let orders = rows.map((row) => staffOrderFromRow(row, user));
          const queue = url.searchParams.get("queue") || "active";
          const search = String(url.searchParams.get("search") || "").trim().toLowerCase();
          if (queue === "active") orders = orders.filter((order) => !["completed", "delivered", "cancelled"].includes(order.status));
          else if (queue === "completed") orders = orders.filter((order) => order.status === "completed");
          else if (queue) orders = orders.filter((order) => order.status === queue);
          if (search) orders = orders.filter((order) => JSON.stringify(order).toLowerCase().includes(search));
          return send(res, 200, { orders });
        }
        const orderId = path[2];
        const row = await getOrderRow(orderId);
        if (!row) return fail(res, 404, "Order not found.");
        if (req.method === "GET" && path.length === 3) return send(res, 200, { order: staffOrderFromRow(row, user) });
        if (req.method === "POST" && path[3] === "delivery-proof") {
          if (row.status !== "out_for_delivery") return fail(res, 409, "Proof can be uploaded only for an order that is out for delivery.");
          const body = await readJson(req);
          const parsed = parseDataUrl(body);
          const id = randomUUID();
          const fileName = safeFilename(body.fileName, parsed.contentType);
          const blob = await put(`delivery-proofs/${orderId}/${id}/${fileName}`, parsed.bytes, { access: "private", contentType: parsed.contentType, addRandomSuffix: false });
          await sql`INSERT INTO protected_files (id, owner_user_id, kind, target_id, blob_url, pathname, file_name, content_type, size_bytes) VALUES (${id}, ${user.id}, 'delivery', ${orderId}, ${blob.url}, ${blob.pathname}, ${fileName}, ${parsed.contentType}, ${parsed.bytes.length})`;
          await audit(user.id, "delivery_proof.uploaded", "order", orderId, { ownerId: row.owner_user_id, fileId: id });
          return send(res, 201, { id, fileReference: id, fileName });
        }
        if (req.method === "POST" && path[3] === "status") {
          return fail(res, 409, "Use dispatch, delivery confirmation, or delivery failure to update fulfillment.");
        }
        if (req.method === "POST" && path[3] === "delivery-assignment") {
          if (!["payment_confirmed", "delivery_failed"].includes(row.status)) return fail(res, 409, "Only a paid or failed delivery can be assigned.");
          const body = await readJson(req);
          if (!String(body.deliveryPersonId || body.deliveryPersonName || "").trim()) return fail(res, 400, "Enter a delivery person ID or name.");
          const now = new Date().toISOString();
          const data = { ...(row.data || {}), deliveryAssignment: { deliveryPersonId: String(body.deliveryPersonId || "").trim(), deliveryPersonName: String(body.deliveryPersonName || "").trim(), deliveryPersonPhone: String(body.deliveryPersonPhone || "").trim(), note: String(body.note || "").trim(), assignedAt: now, assignedBy: user.name } };
          data.internalTimeline = [...(data.internalTimeline || []), { id: randomUUID(), label: `Delivery assigned to ${data.deliveryAssignment.deliveryPersonName || data.deliveryAssignment.deliveryPersonId}`, createdAt: now, actor: { name: user.name } }];
          await sql`UPDATE orders SET data=${JSON.stringify(data)}::jsonb, updated_at=now() WHERE id=${orderId}`;
          await audit(user.id, "order.delivery_assigned", "order", orderId, { ownerId: row.owner_user_id });
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "dispatch") {
          const body = await readJson(req);
          if (!row.data?.deliveryAssignment) return fail(res, 409, "Assign delivery before dispatching the order.");
          if (!["payment_confirmed", "delivery_failed"].includes(row.status)) return fail(res, 409, "Only a paid or failed delivery can be dispatched.");
          const now = new Date().toISOString();
          const note = String(body.note || "").trim() || "Your order is out for delivery.";
          const data = { ...(row.data || {}), deliveryStatusLabel: "Out for delivery", dispatchedAt: now };
          data.statusHistory = [...(data.statusHistory || []), { id: randomUUID(), status: "out_for_delivery", customerLabel: "Out for delivery", note, createdAt: now }];
          data.internalTimeline = [...(data.internalTimeline || []), { id: randomUUID(), label: "Order dispatched", createdAt: now, actor: { name: user.name } }];
          await saveOrderState(row, "out_for_delivery", data, user.id, "order.dispatched", "Order dispatched", note);
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "delivery-confirmation") {
          if (row.status !== "out_for_delivery") return fail(res, 409, "Only an order that is out for delivery can be confirmed delivered.");
          const body = await readJson(req);
          const proof = await sql`SELECT id FROM protected_files WHERE id=${body.proofReference} AND kind='delivery' AND target_id=${orderId}`;
          if (!proof[0]) return fail(res, 400, "Upload valid proof of delivery first.");
          const now = new Date().toISOString();
          const note = String(body.deliveryNote || "").trim() || "Delivery confirmed.";
          const data = { ...(row.data || {}), deliveryStatusLabel: "Completed", deliveredAt: now, completedAt: now, deliveryProofReference: body.proofReference, deliveryNote: note };
          data.statusHistory = [...(data.statusHistory || []), { id: randomUUID(), status: "completed", customerLabel: "Completed", note, createdAt: now }];
          data.internalTimeline = [...(data.internalTimeline || []), { id: randomUUID(), label: "Delivery completed", createdAt: now, actor: { name: user.name } }];
          await saveOrderState(row, "completed", data, user.id, "order.completed", "Order completed", note);
          await sql`UPDATE medication_requests SET status='completed', updated_at=now() WHERE id=${row.request_id}`;
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "delivery-failure") {
          if (row.status !== "out_for_delivery") return fail(res, 409, "Only an order that is out for delivery can record a delivery failure.");
          const body = await readJson(req);
          const note = String(body.note || "").trim();
          if (!note) return fail(res, 400, "A delivery-failure note is required.");
          const reason = String(body.reason || "other");
          const now = new Date().toISOString();
          const data = { ...(row.data || {}), deliveryStatusLabel: "Delivery failed", lastDeliveryFailure: { reason, note, createdAt: now } };
          data.statusHistory = [...(data.statusHistory || []), { id: randomUUID(), status: "delivery_failed", customerLabel: "Delivery needs attention", note, createdAt: now }];
          data.internalTimeline = [...(data.internalTimeline || []), { id: randomUUID(), label: `Delivery failed: ${reason.replaceAll("_", " ")}`, createdAt: now, actor: { name: user.name } }];
          await saveOrderState(row, "delivery_failed", data, user.id, "order.delivery_failed", "Delivery needs attention", note);
          return send(res, 200, { ok: true });
        }
      }
      if (path[1] === "analytics" && req.method === "GET") {
        if (!requireRole(user, res, ["admin"])) return;
        const range = url.searchParams.get("range") || "30d";
        const days = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[range] || 30;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const customers = (await sql`SELECT count(*)::int count FROM app_profiles WHERE created_at >= ${cutoff}`)[0].count;
        const beneficiariesCount = (await sql`SELECT count(*)::int count FROM beneficiaries WHERE created_at >= ${cutoff}`)[0].count;
        const requestsSubmitted = (await sql`SELECT count(*)::int count FROM medication_requests WHERE created_at >= ${cutoff}`)[0].count;
        const requestsFulfilled = (await sql`SELECT count(*)::int count FROM medication_requests WHERE created_at >= ${cutoff} AND status IN ('delivered','completed')`)[0].count;
        const quoteStats = (await sql`SELECT count(*)::int total, count(*) FILTER (WHERE status='approved')::int approved FROM quotes WHERE created_at >= ${cutoff}`)[0];
        const repeatStats = (await sql`SELECT count(*)::int total, count(*) FILTER (WHERE request_count > 1)::int repeat FROM (SELECT owner_user_id, count(*) request_count FROM medication_requests WHERE created_at >= ${cutoff} GROUP BY owner_user_id) owners`)[0];
        const orderStats = (await sql`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (o.updated_at-o.created_at))/3600) FILTER (WHERE o.status='completed') median_hours FROM orders o WHERE o.created_at >= ${cutoff}`)[0];
        const averageOrderValues = await sql`SELECT p.currency, avg(p.amount_minor)::float8 average_minor, count(*)::int order_count FROM orders o JOIN payments p ON p.id=o.payment_id WHERE o.created_at >= ${cutoff} GROUP BY p.currency ORDER BY p.currency`;
        const countryCounts = await sql`SELECT COALESCE(NULLIF(ap.profile->>'countryName',''), NULLIF(ap.profile->>'country',''), 'Not provided') label, count(*)::int value FROM medication_requests r JOIN app_profiles ap ON ap.user_id=r.owner_user_id WHERE r.created_at >= ${cutoff} GROUP BY label ORDER BY value DESC`;
        const outcomes = await sql`SELECT status, count(*)::int value FROM orders WHERE created_at >= ${cutoff} GROUP BY status ORDER BY value DESC`;
        const countryTotal = countryCounts.reduce((sum, entry) => sum + entry.value, 0);
        const outcomeTotal = outcomes.reduce((sum, entry) => sum + entry.value, 0);
        return send(res, 200, { metrics: { customers, beneficiaries: beneficiariesCount, requestsSubmitted, requestsFulfilled, quoteApprovalRate: quoteStats.total ? quoteStats.approved / quoteStats.total * 100 : 0, repeatCustomerRate: repeatStats.total ? repeatStats.repeat / repeatStats.total * 100 : 0, medianFulfillmentHours: Number(orderStats.median_hours || 0) }, averageOrderValues: averageOrderValues.map((item) => ({ currency: item.currency, amountMinor: Math.round(Number(item.average_minor || 0)), orderCount: item.order_count })), requestsByCustomerCountry: countryCounts.map((item) => ({ key: item.label, label: item.label, value: item.value, percent: countryTotal ? item.value / countryTotal * 100 : 0 })), fulfillmentOutcomes: outcomes.map((item) => ({ key: item.status, label: statusLabel(item.status), value: item.value, percent: outcomeTotal ? item.value / outcomeTotal * 100 : 0 })), generatedAt: new Date().toISOString() });
      }
      if (path[1] === "audit-logs" && req.method === "GET") {
        if (!requireRole(user, res, ["admin"])) return;
        const rows = await sql`SELECT a.*, p.email actor_email, p.full_name actor_name, p.roles actor_roles FROM audit_events a LEFT JOIN app_profiles p ON p.user_id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 200`;
        const action = String(url.searchParams.get("action") || "").toLowerCase();
        const actor = String(url.searchParams.get("actor") || "").toLowerCase();
        const entity = String(url.searchParams.get("entity") || "").toLowerCase();
        const dateFrom = url.searchParams.get("dateFrom");
        const dateTo = url.searchParams.get("dateTo");
        const logs = rows.filter((item) => (!action || item.event_type.toLowerCase().includes(action)) && (!actor || `${item.actor_email || ""} ${item.actor_user_id || ""}`.toLowerCase().includes(actor)) && (!entity || `${item.target_type || ""} ${item.target_id || ""}`.toLowerCase().includes(entity)) && (!dateFrom || new Date(item.created_at) >= new Date(dateFrom)) && (!dateTo || new Date(item.created_at) < new Date(`${dateTo}T23:59:59.999Z`))).slice(0, 100).map((item) => ({ id: item.id, createdAt: item.created_at, actor: { displayName: item.actor_name, email: item.actor_email, role: item.actor_roles?.join(", ") }, action: item.event_type, actionLabel: item.event_type.replaceAll("_", " ").replaceAll(".", " · "), entityType: item.target_type, entityId: item.target_id, entityPublicId: item.target_id, result: "recorded", contextLabel: item.metadata?.status || item.metadata?.outcome }));
        return send(res, 200, { logs, nextCursor: "" });
      }
      if (path[1] === "security" && path[2] === "overview" && req.method === "GET") {
        if (!requireRole(user, res, ["admin"])) return;
        const checkedAt = new Date().toISOString();
        const securityEventCount = (await sql`SELECT count(*)::int count FROM audit_events WHERE created_at > now() - interval '24 hours' AND (event_type LIKE 'auth.%' OR event_type LIKE 'security.%' OR event_type LIKE 'access.denied%')`)[0].count;
        return send(res, 200, { failedSignIns: { status: "unknown", value: "Provider managed", detail: "Review sign-in attempts in Neon Auth.", checkedAt }, suspiciousEvents: { status: securityEventCount ? "attention" : "healthy", value: securityEventCount, detail: "Recorded denied or failed server events in the last 24 hours.", checkedAt }, activeStaffSessions: { status: "unknown", value: "Provider managed", detail: "Active sessions remain in Neon Auth.", checkedAt }, uploadScanning: { status: "unknown", value: "Not configured", detail: "Private files are type and size validated; malware scanning is not yet connected.", checkedAt }, paymentWebhooks: { status: "verified", value: "Not applicable", detail: "Payments use manually verified bank-transfer receipts.", checkedAt }, backupRestore: { status: "unknown", value: "Neon managed", detail: "Schedule and document a restore drill before launch.", checkedAt }, generatedAt: checkedAt });
      }
    }

    if (path[0] === "notifications") {
      if (req.method === "GET" && path[1] === "unread-count") {
        const count = (await sql`SELECT count(*)::int count FROM notifications WHERE owner_user_id=${user.id} AND read_at IS NULL`)[0].count;
        return send(res, 200, { unreadCount: count });
      }
      if (req.method === "GET" && path.length === 1) {
        const unreadOnly = url.searchParams.get("view") === "unread";
        const rows = unreadOnly ? await sql`SELECT * FROM notifications WHERE owner_user_id=${user.id} AND read_at IS NULL ORDER BY created_at DESC LIMIT 100` : await sql`SELECT * FROM notifications WHERE owner_user_id=${user.id} ORDER BY created_at DESC LIMIT 100`;
        return send(res, 200, { notifications: rows.map(notificationFromRow), nextCursor: "" });
      }
      if (req.method === "POST" && path[1] === "read-all") {
        await sql`UPDATE notifications SET read_at=COALESCE(read_at, now()) WHERE owner_user_id=${user.id}`;
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && path[2] === "read") {
        const rows = await sql`UPDATE notifications SET read_at=COALESCE(read_at, now()) WHERE id=${path[1]} AND owner_user_id=${user.id} RETURNING id`;
        return rows[0] ? send(res, 200, { ok: true }) : fail(res, 404, "Notification not found.");
      }
    }
    if (path[0] === "communication-preferences") {
      const defaults = { emailEnabled: true, smsEnabled: false, whatsappEnabled: false, preferredLanguage: "en", timezone: "Africa/Addis_Ababa" };
      if (req.method === "GET") {
        const rows = await sql`SELECT data FROM communication_preferences WHERE user_id=${user.id}`;
        return send(res, 200, { preferences: { ...defaults, ...(rows[0]?.data || {}) } });
      }
      if (req.method === "PUT") {
        const body = await readJson(req);
        const preferences = { emailEnabled: Boolean(body.emailEnabled), smsEnabled: Boolean(body.smsEnabled), whatsappEnabled: Boolean(body.whatsappEnabled), preferredLanguage: ["en", "am", "om"].includes(body.preferredLanguage) ? body.preferredLanguage : "en", timezone: String(body.timezone || defaults.timezone).slice(0, 80) };
        await sql`INSERT INTO communication_preferences (user_id, data) VALUES (${user.id}, ${JSON.stringify(preferences)}::jsonb) ON CONFLICT (user_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`;
        await audit(user.id, "communication_preferences.updated", "account", user.id, { ownerId: user.id });
        return send(res, 200, { preferences });
      }
    }
    if (path[0] === "account-activity" && req.method === "GET") {
      const rows = await sql`SELECT a.*, p.email actor_email, p.full_name actor_name FROM audit_events a LEFT JOIN app_profiles p ON p.user_id=a.actor_user_id WHERE a.actor_user_id=${user.id} OR a.metadata->>'ownerId'=${user.id} ORDER BY a.created_at DESC LIMIT 100`;
      const events = rows.map((item) => ({ id: item.id, createdAt: item.created_at, customerLabel: item.event_type.replaceAll("_", " ").replaceAll(".", " · "), actorLabel: item.actor_user_id === user.id ? "You" : item.actor_name || "Hakim Plus", entityLabel: item.target_type, note: item.metadata?.status ? statusLabel(item.metadata.status) : undefined }));
      return send(res, 200, { events, nextCursor: "" });
    }
    return fail(res, 404, "API route not found.");
  } catch (error) {
    console.error("Hakim Plus API error", error);
    return fail(res, error.status || 500, error.status ? error.message : "We could not complete that request.");
  }
}
