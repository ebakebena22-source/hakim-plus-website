import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("privileged governance routes require the admin role", async () => {
  const router = await source("src/router.jsx");
  for (const route of ["analytics", "audit-logs", "security"]) {
    assert.match(router, new RegExp(`path="${route}"[^\n]+allowedRoles=\\{\\["admin"\\]\\}`));
  }
});

test("payment is a private bank-transfer receipt workflow", async () => {
  const payments = await source("src/api/payments.js");
  assert.match(payments, /submitBankTransfer/);
  assert.match(payments, /bank-transfer/);
  const checkout = await source("src/pages/PaymentPages.jsx");
  assert.match(checkout, /Submit transfer receipt/);
  assert.match(checkout, /image\/jpeg,image\/png,application\/pdf/);
  assert.doesNotMatch(checkout, /hosted checkout/i);
});

test("production API uses Neon and private Vercel Blob storage", async () => {
  const api = await source("api/v1/[...path].js");
  assert.match(api, /@neondatabase\/serverless/);
  assert.match(api, /@vercel\/blob/);
  assert.match(api, /access: "private"/);
  assert.match(api, /Commercial Bank of Ethiopia/);
  assert.match(api, /1000746304483/);
});

test("public shell contains no third-party behavioral tracking", async () => {
  const html = await source("index.html");
  const landing = await source("src/App.jsx");
  assert.doesNotMatch(html, /facebook\.com\/tr|fbevents\.js|fbq\(/);
  assert.doesNotMatch(landing, /@vercel\/analytics|trackMetaEvent|fbq\(/);
  assert.match(landing, /<Button href="\/signup"[^>]*>Start with this option<\/Button>/);
});

test("Vercel Web Analytics is mounted once at the application root", async () => {
  const main = await source("src/main.jsx");
  assert.match(main, /import \{ Analytics \} from ['"]@vercel\/analytics\/react['"]/);
  assert.equal((main.match(/<Analytics\s*\/>/g) || []).length, 1);
});

test("the supplied Hakim Plus mark is used for site branding and the browser icon", async () => {
  const html = await source("index.html");
  const brand = await source("src/components/BrandLogo.jsx");
  const authShell = await source("src/components/AuthShell.jsx");
  const landing = await source("src/App.jsx");
  const admin = await source("src/layouts/AdminLayout.jsx");
  assert.match(html, /rel="icon"[^>]+hakim-plus-logo\.png/);
  assert.match(html, /rel="apple-touch-icon"[^>]+hakim-plus-logo\.png/);
  assert.match(brand, /\/hakim-plus-logo\.png/);
  for (const shell of [authShell, landing, admin]) assert.match(shell, /BrandLogo/);
});

test("client analytics accepts only explicitly safe context", async () => {
  const analytics = await source("src/analytics/safeEvents.js");
  assert.match(analytics, /allowedEvents/);
  assert.match(analytics, /allowedContextKeys/);
  for (const sensitiveKey of ["beneficiaryName", "medicationName", "prescription", "message"]) {
    assert.doesNotMatch(analytics, new RegExp(`allowedContextKeys[^;]+${sensitiveKey}`, "s"));
  }
});

test("production hosting configuration includes core security headers", async () => {
  const config = JSON.parse(await source("vercel.json"));
  const headers = config.headers.flatMap((entry) => entry.headers).map((header) => header.key);
  for (const required of ["Content-Security-Policy", "Referrer-Policy", "X-Content-Type-Options", "Permissions-Policy"]) {
    assert.ok(headers.includes(required), `${required} is required`);
  }
});

test("local preview auth is localhost-only and does not store raw passwords", async () => {
  const auth = await source("src/auth/authClient.js");
  assert.match(auth, /localHosts\.has\(window\.location\.hostname\)/);
  assert.match(auth, /crypto\.subtle\.digest/);
  assert.match(auth, /passwordHash/);
  assert.doesNotMatch(auth, /accounts\.push\(\{\s*user,\s*password:/);
  assert.match(auth, /roles: \["customer"\]/);
});

test("customer and admin API contracts agree on protected upload payloads", async () => {
  const api = await source("api/v1/[...path].js");
  const uploads = await source("src/api/protectedUploads.js");
  const messages = await source("src/pages/MessageThreadPage.jsx");
  assert.match(uploads, /message-attachments/);
  assert.match(uploads, /delivery-proof/);
  assert.match(messages, /fileReferences/);
  assert.match(api, /body\.fileReferences \|\| body\.attachments/);
  assert.match(api, /target_id=\$\{requestId\}/);
  assert.match(api, /uploaded file content does not match its declared type/);
  assert.match(api, /bytes\.subarray\(0, 5\)\.toString\("ascii"\) === "%PDF-"/);
});

test("production API enforces server-side role and workflow boundaries", async () => {
  const api = await source("api/v1/[...path].js");
  for (const roles of [
    '["admin", "pharmacist"]',
    '["admin", "pharmacist", "customer_support"]',
    '["admin", "pharmacist", "fulfillment", "delivery_operations"]',
    '["admin"]',
  ]) assert.ok(api.includes(`requireRole(user, res, ${roles})`), `missing role guard ${roles}`);
  assert.match(api, /Only the current sent quote can be approved/);
  assert.match(api, /This quote has expired/);
  assert.match(api, /Only a pending transfer can be approved/);
  assert.match(api, /Only a pending transfer can be rejected/);
  assert.match(api, /Only an order that is out for delivery can be confirmed delivered/);
  assert.match(api, /Beneficiary contact is not authorized/);
});

test("notification preferences, account activity, messages, and order actions are real API routes", async () => {
  const api = await source("api/v1/[...path].js");
  for (const route of ["notifications", "communication-preferences", "account-activity", "messages", "request-again", "delivery-assignment", "delivery-confirmation", "delivery-failure"]) {
    assert.ok(api.includes(`"${route}"`), `missing ${route} route`);
  }
  assert.match(api, /CREATE TABLE IF NOT EXISTS communication_preferences/);
  assert.match(api, /INSERT INTO communication_preferences/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS notifications/);
});

test("customer request schema matches the production API field names", async () => {
  const schema = await source("src/requests/requestSchema.js");
  const api = await source("api/v1/[...path].js");
  assert.match(schema, /submissionMethod: request\.method/);
  assert.match(api, /data\.submissionMethod \|\| data\.method/);
  assert.match(schema, /at least 10 characters/);
  assert.match(api, /String\(data\.description \|\| ""\)\.trim\(\)\.length < 10/);
});

test("quote calculations clamp totals and validation rejects unsafe quote states", async () => {
  const { calculateQuotePreview, validateQuote, createQuotePayload } = await import("../src/quotes/quoteSchema.js");
  const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  const quote = { currency: "ETB", expiresAt: future, deliveryFee: "20", serviceFee: "5", tax: "0", discount: "500", pharmacyNotes: "", items: [{ medicationName: "QA item", quotedQuantity: "2", unitPrice: "100", availability: "available", strength: "", dosageForm: "", unitLabel: "pack", pharmacyNote: "" }] };
  assert.deepEqual(calculateQuotePreview(quote), { itemSubtotalMinor: 20_000, grandTotalMinor: 0 });
  assert.deepEqual(validateQuote(quote), {});
  assert.match(createQuotePayload(quote).expiresAt, /Z$/);
  assert.ok(validateQuote({ ...quote, expiresAt: "2020-01-01T00:00" }).expiresAt);
  assert.ok(validateQuote({ ...quote, items: [{ ...quote.items[0], quotedQuantity: "1.5" }] })["item-0-pricing"]);
});

test("customer past orders and role-aware staff UI use the corrected flows", async () => {
  const api = await source("api/v1/[...path].js");
  const requestPage = await source("src/pages/AdminRequestPages.jsx");
  const quotePage = await source("src/pages/AdminQuotePage.jsx");
  assert.match(api, /\["past", "history", "completed"\]\.includes\(view\)/);
  assert.match(requestPage, /canQuote && <section/);
  assert.match(quotePage, /defaultQuoteExpiry/);
});

test("security overview excludes ordinary fulfillment failures", async () => {
  const api = await source("api/v1/[...path].js");
  assert.match(api, /event_type LIKE 'auth\.%'/);
  assert.doesNotMatch(api, /event_type ILIKE '%failed%'/);
});

test("customer dashboard loads live portal data instead of placeholder counts", async () => {
  const portal = await source("src/pages/PortalPages.jsx");
  for (const api of ["beneficiariesApi.list", "requestsApi.list", "ordersApi.list", "notificationsApi.list"]) assert.ok(portal.includes(api), `dashboard must use ${api}`);
  assert.doesNotMatch(portal, /\[\['Beneficiaries', '0'\]/);
  assert.match(portal, /actionRequests/);
  assert.match(portal, /recentActivity/);
});

test("signup establishes a session when Neon does not require verification", async () => {
  const api = await source("api/v1/[...path].js");
  assert.match(api, /const signInUpstream = await callAuth\(req, "\/sign-in\/email"/);
  assert.match(api, /copyAuthCookies\(signInUpstream, res\)/);
  assert.match(api, /const requiresVerification = !accountReady/);
});
