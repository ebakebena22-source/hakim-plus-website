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
