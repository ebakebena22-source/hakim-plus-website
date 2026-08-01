import { neon } from "@neondatabase/serverless";
import { get, put } from "@vercel/blob";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import process from "node:process";

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
  const headers = { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) };
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  // This request is a trusted server-to-server hop. Forwarding the browser's
  // custom-domain Origin makes the managed auth service treat the proxy as a
  // direct cross-origin client and reject valid signups.
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
    endpoint = "/sign-up/email";
    body = { email: String(form.email).trim().toLowerCase(), password: form.password, name: `${form.firstName} ${form.lastName}`.trim() };
    const upstream = await callAuth(req, endpoint, { method: "POST", body });
    copyAuthCookies(upstream, res);
    const payload = authPayload(await upstream.json().catch(() => ({})));
    if (!upstream.ok) return fail(res, upstream.status, payload.message || "The account could not be created.");
    const user = payload.user || payload;
    if (user?.id) await upsertProfile(user, { firstName: form.firstName, lastName: form.lastName, phone: form.phone, country: form.country });
    const requiresVerification = user?.emailVerified !== true && !payload.session;
    return send(res, 200, { user: requiresVerification ? null : await publicUser(user), requiresVerification });
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
    await sql`CREATE TABLE IF NOT EXISTS audit_events (
      id text PRIMARY KEY, actor_user_id text, event_type text NOT NULL, target_type text, target_id text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`;
  })().catch((error) => { schemaPromise = undefined; throw error; });
  return schemaPromise;
}

function numberCode(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function statusLabel(status) {
  const labels = { submitted: "Submitted", under_review: "Under review", awaiting_information: "Information requested", quote_ready: "Quote ready", awaiting_payment: "Awaiting payment", payment_verification: "Transfer awaiting verification", paid: "Payment confirmed", payment_confirmed: "Payment confirmed", preparing: "Preparing", dispatched: "Dispatched", delivered: "Delivered", cancelled: "Cancelled", unable_to_fulfill: "Unable to fulfill", pending: "Awaiting verification", approved: "Approved", rejected: "Rejected", confirmed: "Confirmed" };
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
  return { ...data, id: row.id, publicId: row.id, requestNumber: row.request_number, status: row.status, statusLabel: statusLabel(row.status), beneficiary: row.beneficiary_data ? { ...row.beneficiary_data, id: row.beneficiary_id } : undefined, beneficiaryName: row.beneficiary_data?.fullName, customer: row.customer_email ? { email: row.customer_email, fullName: row.customer_name } : undefined, customerName: row.customer_name, submittedAt: row.created_at, createdAt: row.created_at, updatedAt: row.updated_at, statusHistory: history, internalNotes: row.internal_notes || [], customerMessages: row.customer_messages || [], medicationCount: data.medications?.length || 0, actionRequired: ["quote_ready", "awaiting_payment"].includes(row.status), latestUpdate: history.at(-1)?.note, quote: row.quote_id ? { id: row.quote_id, status: row.quote_status } : undefined, order: row.order_id ? { id: row.order_id, publicId: row.order_id } : undefined, orderPath: row.order_id ? `/dashboard/orders/${row.order_id}` : undefined };
}

async function getRequestRow(id, ownerId) {
  const rows = ownerId
    ? await sql`SELECT r.*, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, q.id quote_id, q.status quote_status, o.id order_id FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=r.owner_user_id LEFT JOIN quotes q ON q.request_id=r.id LEFT JOIN orders o ON o.request_id=r.id WHERE r.id=${id} AND r.owner_user_id=${ownerId}`
    : await sql`SELECT r.*, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, q.id quote_id, q.status quote_status, o.id order_id FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=r.owner_user_id LEFT JOIN quotes q ON q.request_id=r.id LEFT JOIN orders o ON o.request_id=r.id WHERE r.id=${id}`;
  return rows[0];
}

function parseDataUrl(receipt) {
  const match = String(receipt?.dataUrl || "").match(/^data:(image\/jpeg|image\/png|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error("Use a valid JPG, PNG, or PDF receipt."), { status: 400 });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 2.5 * 1024 * 1024) throw Object.assign(new Error("The receipt must be 2.5 MB or smaller."), { status: 400 });
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
  res.setHeader("Content-Disposition", `inline; filename="${String(fileName).replace(/["\r\n]/g, "")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  for await (const chunk of result.stream) res.write(chunk);
  res.end();
}

async function audit(actorId, eventType, targetType, targetId, metadata = {}) {
  await sql`INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, metadata) VALUES (${randomUUID()}, ${actorId}, ${eventType}, ${targetType}, ${targetId}, ${JSON.stringify(metadata)}::jsonb)`;
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
        const rows = await sql`SELECT r.*, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, q.id quote_id, q.status quote_status, o.id order_id FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=r.owner_user_id LEFT JOIN quotes q ON q.request_id=r.id LEFT JOIN orders o ON o.request_id=r.id WHERE r.owner_user_id=${user.id} ORDER BY r.created_at DESC`;
        let requests = rows.map(requestFromRow);
        const status = url.searchParams.get("status");
        const search = String(url.searchParams.get("search") || "").toLowerCase();
        if (status && status !== "all") requests = requests.filter((item) => status === "active" ? !["delivered", "cancelled", "unable_to_fulfill"].includes(item.status) : status === "needs_action" ? item.actionRequired : status === "completed" ? item.status === "delivered" : item.status === status);
        if (search) requests = requests.filter((item) => JSON.stringify(item).toLowerCase().includes(search));
        return send(res, 200, { requests });
      }
      if (req.method === "POST" && path.length === 1) {
        const data = await readJson(req);
        const beneficiaries = await sql`SELECT id FROM beneficiaries WHERE id=${data.beneficiaryId} AND owner_user_id=${user.id} AND archived=false`;
        if (!beneficiaries[0] || !data.accuracyConfirmed) return fail(res, 400, "Select a valid beneficiary and confirm the request details.");
        const id = randomUUID();
        const requestNumber = numberCode("HPR");
        const history = [{ id: randomUUID(), status: "submitted", customerLabel: "Request submitted", note: "Hakim Plus received the medication request.", createdAt: new Date().toISOString() }];
        await sql`INSERT INTO medication_requests (id, owner_user_id, beneficiary_id, request_number, data, status_history) VALUES (${id}, ${user.id}, ${data.beneficiaryId}, ${requestNumber}, ${JSON.stringify(data)}::jsonb, ${JSON.stringify(history)}::jsonb)`;
        await audit(user.id, "request.created", "medication_request", id);
        const row = await getRequestRow(id, user.id);
        return send(res, 201, { request: requestFromRow(row) });
      }
      const requestId = path[1];
      if (req.method === "GET" && path.length === 2) {
        const row = await getRequestRow(requestId, user.id);
        if (!row) return fail(res, 404, "Medication request not found.");
        return send(res, 200, { request: requestFromRow(row) });
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
        await audit(user.id, "bank_transfer.submitted", "bank_transfer", id, { requestId });
        return send(res, 201, { transfer: { id, transferNumber, status: "pending" } });
      }
    }

    if (path[0] === "quotes" && req.method === "POST") {
      const quoteId = path[1];
      const rows = await sql`SELECT q.*, r.id request_id, r.owner_user_id FROM quotes q JOIN medication_requests r ON r.id=q.request_id WHERE q.id=${quoteId} AND r.owner_user_id=${user.id}`;
      if (!rows[0]) return fail(res, 404, "Quote not found.");
      if (path[2] === "approve") {
        await sql`UPDATE quotes SET status='approved', approved_at=now(), updated_at=now() WHERE id=${quoteId}`;
        await sql`UPDATE medication_requests SET status='awaiting_payment', updated_at=now() WHERE id=${rows[0].request_id}`;
        return send(res, 200, { quote: { id: quoteId, status: "approved" }, paymentPath: `/dashboard/requests/${rows[0].request_id}/payment` });
      }
      const body = await readJson(req);
      if (path[2] === "request-change") {
        await sql`UPDATE quotes SET status='change_requested', updated_at=now() WHERE id=${quoteId}`;
        await sql`UPDATE medication_requests SET status='under_review', customer_messages=customer_messages || ${JSON.stringify([{ id: randomUUID(), message: body.message, author: { name: "Customer" }, createdAt: new Date().toISOString() }])}::jsonb, updated_at=now() WHERE id=${rows[0].request_id}`;
        return send(res, 200, { ok: true });
      }
      if (path[2] === "decline") {
        await sql`UPDATE quotes SET status='declined', updated_at=now() WHERE id=${quoteId}`;
        await sql`UPDATE medication_requests SET status='cancelled', updated_at=now() WHERE id=${rows[0].request_id}`;
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
        const rows = await sql`SELECT o.*, r.request_number, b.data beneficiary_data, p.amount_minor, p.currency FROM orders o JOIN medication_requests r ON r.id=o.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN payments p ON p.id=o.payment_id WHERE o.owner_user_id=${user.id} ORDER BY o.created_at DESC`;
        return send(res, 200, { orders: rows.map((row) => ({ ...row.data, id: row.id, publicId: row.id, orderNumber: row.order_number, requestNumber: row.request_number, beneficiaryName: row.beneficiary_data.fullName, status: row.status, statusLabel: statusLabel(row.status), amountMinor: row.amount_minor, currency: row.currency, createdAt: row.created_at })) });
      }
      if (req.method === "GET" && path.length === 2) {
        const rows = await sql`SELECT o.*, r.request_number, r.data request_data, b.data beneficiary_data, p.amount_minor, p.currency FROM orders o JOIN medication_requests r ON r.id=o.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN payments p ON p.id=o.payment_id WHERE o.id=${path[1]} AND o.owner_user_id=${user.id}`;
        if (!rows[0]) return fail(res, 404, "Order not found.");
        const row = rows[0];
        return send(res, 200, { order: { ...row.data, id: row.id, publicId: row.id, orderNumber: row.order_number, requestNumber: row.request_number, beneficiary: row.beneficiary_data, status: row.status, statusLabel: statusLabel(row.status), amountMinor: row.amount_minor, currency: row.currency, items: row.request_data.medications || [], createdAt: row.created_at, statusHistory: [{ status: "payment_confirmed", customerLabel: "Payment confirmed", createdAt: row.created_at }] } });
      }
    }

    if (path[0] === "admin") {
      if (path[1] === "dashboard" && req.method === "GET") {
        const rows = await sql`SELECT status, count(*)::int count FROM medication_requests GROUP BY status`;
        const counts = Object.fromEntries(rows.map((row) => [row.status, row.count]));
        const pending = (await sql`SELECT count(*)::int count FROM bank_transfers WHERE status='pending'`)[0].count;
        return send(res, 200, { metrics: { submitted: counts.submitted || 0, needsReview: (counts.submitted || 0) + (counts.under_review || 0), awaitingInformation: counts.awaiting_information || 0, quoteReady: counts.quote_ready || 0, awaitingPayment: (counts.awaiting_payment || 0) + pending, activeOrders: (counts.paid || 0) + (counts.preparing || 0) }, totalOverdue: 0, urgentRequests: 0 });
      }
      if (path[1] === "requests") {
        if (req.method === "GET" && path.length === 2) {
          const rows = await sql`SELECT r.*, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, q.id quote_id, q.status quote_status, o.id order_id FROM medication_requests r JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=r.owner_user_id LEFT JOIN quotes q ON q.request_id=r.id LEFT JOIN orders o ON o.request_id=r.id ORDER BY r.created_at DESC`;
          let requests = rows.map(requestFromRow);
          const queue = url.searchParams.get("queue");
          const search = String(url.searchParams.get("search") || "").toLowerCase();
          if (queue && !["all", "overdue", "urgent"].includes(queue)) requests = requests.filter((item) => item.status === queue);
          if (queue === "urgent") requests = requests.filter((item) => item.urgent);
          if (search) requests = requests.filter((item) => JSON.stringify(item).toLowerCase().includes(search));
          return send(res, 200, { requests });
        }
        const requestId = path[2];
        const row = await getRequestRow(requestId);
        if (!row) return fail(res, 404, "Medication request not found.");
        if (req.method === "GET" && path.length === 3) {
          const request = requestFromRow(row);
          const refs = (request.fileReferences || []).map((item) => item.fileReference).filter(Boolean);
          if (refs.length) {
            const files = await sql`SELECT id, file_name FROM protected_files WHERE id = ANY(${refs})`;
            request.files = files.map((file) => ({ id: file.id, fileReference: file.id, fileName: file.file_name, viewUrl: `/api/v1/admin/request-files/${file.id}` }));
          }
          return send(res, 200, { request });
        }
        if (path[3] === "quote") {
          if (req.method === "GET" && path.length === 4) {
            const rows = await sql`SELECT * FROM quotes WHERE request_id=${requestId}`;
            return send(res, 200, { quote: rows[0] ? { ...quoteTotals(rows[0].data), id: rows[0].id, quoteNumber: rows[0].quote_number, status: rows[0].status, expiresAt: rows[0].data.expiresAt } : null });
          }
          if (req.method === "PUT" && path.length === 4) {
            const data = quoteTotals(await readJson(req));
            const existing = await sql`SELECT id FROM quotes WHERE request_id=${requestId}`;
            const id = existing[0]?.id || randomUUID();
            if (existing[0]) await sql`UPDATE quotes SET data=${JSON.stringify(data)}::jsonb, status='draft', updated_at=now() WHERE id=${id}`;
            else await sql`INSERT INTO quotes (id, request_id, quote_number, data) VALUES (${id}, ${requestId}, ${numberCode('Q')}, ${JSON.stringify(data)}::jsonb)`;
            const saved = await sql`SELECT * FROM quotes WHERE id=${id}`;
            return send(res, 200, { quote: { ...saved[0].data, id, quoteNumber: saved[0].quote_number, status: saved[0].status } });
          }
          if (req.method === "POST" && path[4] === "send") {
            const quotes = await sql`SELECT id FROM quotes WHERE request_id=${requestId}`;
            if (!quotes[0]) return fail(res, 409, "Save the quote before sending it.");
            await sql`UPDATE quotes SET status='sent', sent_at=now(), updated_at=now() WHERE request_id=${requestId}`;
            await sql`UPDATE medication_requests SET status='quote_ready', updated_at=now() WHERE id=${requestId}`;
            await audit(user.id, "quote.sent", "medication_request", requestId);
            return send(res, 200, { ok: true });
          }
        }
        if (req.method === "POST" && path[3] === "status") {
          const body = await readJson(req);
          const status = String(body.status || body.nextStatus || "under_review");
          const event = { id: randomUUID(), status, customerLabel: statusLabel(status), note: body.note || "Status updated by Hakim Plus.", createdAt: new Date().toISOString() };
          await sql`UPDATE medication_requests SET status=${status}, status_history=status_history || ${JSON.stringify([event])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "internal-notes") {
          const body = await readJson(req);
          const item = { id: randomUUID(), note: body.note, author: { name: user.name }, createdAt: new Date().toISOString() };
          await sql`UPDATE medication_requests SET internal_notes=internal_notes || ${JSON.stringify([item])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "customer-messages") {
          const body = await readJson(req);
          const item = { id: randomUUID(), message: body.message, author: { name: "Hakim Plus" }, createdAt: new Date().toISOString() };
          await sql`UPDATE medication_requests SET customer_messages=customer_messages || ${JSON.stringify([item])}::jsonb, updated_at=now() WHERE id=${requestId}`;
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && ["cancel", "unable-to-fulfill", "request-information"].includes(path[3])) {
          const status = path[3] === "cancel" ? "cancelled" : path[3] === "unable-to-fulfill" ? "unable_to_fulfill" : "awaiting_information";
          await sql`UPDATE medication_requests SET status=${status}, updated_at=now() WHERE id=${requestId}`;
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && path[3] === "beneficiary-contact") return send(res, 200, { ok: true });
      }
      if (path[1] === "request-files" && req.method === "GET") {
        const rows = await sql`SELECT * FROM protected_files WHERE id=${path[2]}`;
        if (!rows[0]) return fail(res, 404, "Protected file not found.");
        await audit(user.id, "protected_file.viewed", "protected_file", path[2]);
        return streamPrivateBlob(res, rows[0].blob_url, rows[0].content_type, rows[0].file_name);
      }
      if (path[1] === "bank-transfers") {
        if (req.method === "GET" && path.length === 2) {
          const rows = await sql`SELECT t.*, r.request_number, b.data beneficiary_data, p.email customer_email, p.full_name customer_name FROM bank_transfers t JOIN medication_requests r ON r.id=t.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=t.owner_user_id ORDER BY t.created_at DESC`;
          const filter = url.searchParams.get("status") || "pending";
          const filtered = filter === "all" ? rows : rows.filter((row) => row.status === filter);
          return send(res, 200, { transfers: filtered.map((row) => ({ id: row.id, transferNumber: row.transfer_number, status: row.status, statusLabel: statusLabel(row.status), amountMinor: row.amount_minor, currency: row.currency, transferReference: row.transfer_reference, transferDate: row.transfer_date, requestNumber: row.request_number, beneficiaryName: row.beneficiary_data.fullName, customerName: row.customer_name, customerEmail: row.customer_email, createdAt: row.created_at, rejectionReason: row.rejection_reason })) });
        }
        const transferId = path[2];
        const rows = await sql`SELECT * FROM bank_transfers WHERE id=${transferId}`;
        if (!rows[0]) return fail(res, 404, "Transfer not found.");
        if (req.method === "GET" && path[3] === "receipt") {
          await audit(user.id, "bank_transfer.receipt_viewed", "bank_transfer", transferId);
          return streamPrivateBlob(res, rows[0].blob_url, rows[0].content_type, rows[0].file_name);
        }
        if (req.method === "POST" && path[3] === "approve") {
          if (rows[0].status !== "pending") return fail(res, 409, "Only a pending transfer can be approved.");
          const body = await readJson(req);
          const paymentId = randomUUID();
          const orderId = randomUUID();
          await sql`UPDATE bank_transfers SET status='approved', reviewed_by=${user.id}, review_note=${String(body.note || '')}, reviewed_at=now() WHERE id=${transferId} AND status='pending'`;
          await sql`INSERT INTO payments (id, transfer_id, request_id, owner_user_id, payment_number, amount_minor, currency) VALUES (${paymentId}, ${transferId}, ${rows[0].request_id}, ${rows[0].owner_user_id}, ${numberCode('PAY')}, ${rows[0].amount_minor}, ${rows[0].currency}) ON CONFLICT (transfer_id) DO NOTHING`;
          const payments = await sql`SELECT id FROM payments WHERE transfer_id=${transferId}`;
          await sql`INSERT INTO orders (id, payment_id, request_id, owner_user_id, order_number) VALUES (${orderId}, ${payments[0].id}, ${rows[0].request_id}, ${rows[0].owner_user_id}, ${numberCode('ORD')}) ON CONFLICT (request_id) DO NOTHING`;
          await sql`UPDATE medication_requests SET status='paid', updated_at=now() WHERE id=${rows[0].request_id}`;
          await audit(user.id, "bank_transfer.approved", "bank_transfer", transferId);
          return send(res, 200, { ok: true, paymentId: payments[0].id });
        }
        if (req.method === "POST" && path[3] === "reject") {
          const body = await readJson(req);
          if (!String(body.reason || "").trim()) return fail(res, 400, "A rejection reason is required.");
          await sql`UPDATE bank_transfers SET status='rejected', rejection_reason=${String(body.reason).trim()}, reviewed_by=${user.id}, reviewed_at=now() WHERE id=${transferId} AND status='pending'`;
          await sql`UPDATE medication_requests SET status='awaiting_payment', updated_at=now() WHERE id=${rows[0].request_id}`;
          await audit(user.id, "bank_transfer.rejected", "bank_transfer", transferId);
          return send(res, 200, { ok: true });
        }
      }
      if (path[1] === "orders" && req.method === "GET") {
        const rows = await sql`SELECT o.*, r.request_number, b.data beneficiary_data, p.email customer_email, p.full_name customer_name, pay.amount_minor, pay.currency FROM orders o JOIN medication_requests r ON r.id=o.request_id JOIN beneficiaries b ON b.id=r.beneficiary_id JOIN app_profiles p ON p.user_id=o.owner_user_id JOIN payments pay ON pay.id=o.payment_id ORDER BY o.created_at DESC`;
        const orders = rows.map((row) => ({ ...row.data, id: row.id, publicId: row.id, orderNumber: row.order_number, requestNumber: row.request_number, beneficiaryName: row.beneficiary_data.fullName, customerName: row.customer_name, customerEmail: row.customer_email, status: row.status, statusLabel: statusLabel(row.status), amountMinor: row.amount_minor, currency: row.currency, createdAt: row.created_at }));
        if (path.length === 2) return send(res, 200, { orders });
        const order = orders.find((item) => item.id === path[2]);
        return order ? send(res, 200, { order }) : fail(res, 404, "Order not found.");
      }
      if (path[1] === "analytics" && req.method === "GET") return send(res, 200, { metrics: {}, series: [], generatedAt: new Date().toISOString() });
      if (path[1] === "audit-logs" && req.method === "GET") {
        const rows = await sql`SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 100`;
        return send(res, 200, { events: rows });
      }
      if (path[1] === "security" && path[2] === "overview" && req.method === "GET") return send(res, 200, { databaseConnected: true, privateStorageConnected: true, authenticationConnected: true, recentSecurityEvents: [] });
    }

    if (path[0] === "notifications") return send(res, 200, path[1] === "unread-count" ? { unreadCount: 0 } : { notifications: [] });
    if (path[0] === "communication-preferences") return send(res, 200, { preferences: { email: true, sms: false, orderUpdates: true, quoteUpdates: true } });
    if (path[0] === "account-activity") return send(res, 200, { events: [] });
    return fail(res, 404, "API route not found.");
  } catch (error) {
    console.error("Hakim Plus API error", error);
    return fail(res, error.status || 500, error.status ? error.message : "We could not complete that request.");
  }
}
