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
  assert.match(landing, /hasActiveSession \? "Go to dashboard" : "Start with this option"/);
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

test("supplied Google and context-aware WhatsApp icons replace placeholder marks", async () => {
  const icons = await source("src/components/SocialIcons.jsx");
  const auth = await source("src/pages/AuthPages.jsx");
  const landing = await source("src/App.jsx");
  const portal = await source("src/pages/PortalPages.jsx");
  assert.match(icons, /google-icon\.png/);
  assert.match(icons, /whatsapp-green\.png/);
  assert.match(icons, /whatsapp-white\.png/);
  assert.match(auth, /<GoogleIcon\s*\/>/);
  assert.doesNotMatch(auth, />G<\/span>/);
  assert.match(landing, /WhatsAppIcon variant="white"/);
  assert.match(landing, /<WhatsAppIcon className=/);
  assert.match(portal, /WhatsAppIcon variant="white"/);
});

test("authenticated homepage visitors are directed back to their dashboard", async () => {
  const landing = await source("src/App.jsx");
  assert.match(landing, /useAuth\(\)/);
  assert.match(landing, /auth\.status === "authenticated"/);
  assert.match(landing, /hasActiveSession \? "\/dashboard" : "\/signup"/);
  assert.match(landing, /hasActiveSession \? <Button href="\/dashboard">Go to dashboard<\/Button>/);
  assert.match(landing, /hasActiveSession \? "Go to dashboard" : "Start with this option"/);
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
  assert.match(requestPage, /canQuote && state\.quote && <AdminQuoteSummary/);
  assert.match(quotePage, /defaultQuoteExpiry/);
});

test("completed orders have a separate read-only admin archive", async () => {
  const layout = await source("src/layouts/AdminLayout.jsx");
  const router = await source("src/router.jsx");
  const ordersPage = await source("src/pages/AdminOrderPages.jsx");
  const dashboard = await source("src/pages/AdminDashboardPage.jsx");
  const api = await source("api/v1/[...path].js");
  assert.ok(layout.indexOf("Bank transfers") < layout.indexOf("Orders & delivery"));
  assert.ok(layout.indexOf("Orders & delivery") < layout.indexOf("Completed orders"));
  assert.match(router, /path="completed-orders"/);
  assert.match(router, /<AdminOrdersPage completedOnly \/>/);
  assert.match(router, /<AdminOrderDetailPage completedView \/>/);
  assert.match(dashboard, /key: "completedOrders", label: "Completed orders", path: "\/admin\/completed-orders"/);
  assert.doesNotMatch(dashboard, /queue=completed/);
  assert.match(ordersPage, /navigate\(`\/admin\/completed-orders\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(ordersPage, /This order is archived as read-only, so delivery cannot be submitted again/);
  assert.doesNotMatch(ordersPage.slice(ordersPage.indexOf("operationalQueues"), ordersPage.indexOf("function formatDate")), /completed/);
  assert.match(api, /queue === "active"[^\n]+!\["completed", "delivered", "cancelled"\]/);
  assert.match(api, /queue === "completed"[^\n]+\["completed", "delivered"\]\.includes/);
});

test("operations dashboard and navigation share four authoritative queue counts", async () => {
  const api = await source("api/v1/[...path].js");
  const dashboard = await source("src/pages/AdminDashboardPage.jsx");
  const layout = await source("src/layouts/AdminLayout.jsx");
  const client = await source("src/api/client.js");
  for (const key of ["medicationRequests", "bankTransfers", "ordersDelivery", "completedOrders"]) {
    assert.match(api, new RegExp(`${key}:`));
    assert.match(dashboard, new RegExp(`key: "${key}"`));
    assert.match(layout, new RegExp(`countKey: "${key}"`));
  }
  for (const removedCard of ["New requests", "Awaiting review", "Need beneficiary contact", "Awaiting quote", "Awaiting customer approval", "Payments received", "Out for delivery", "Delivery failed"]) {
    assert.doesNotMatch(dashboard, new RegExp(removedCard));
  }
  assert.match(api, /bank_transfers WHERE status='pending'/);
  assert.match(client, /ADMIN_ACTION_COUNTS_CHANGED_EVENT/);
  assert.match(layout, /setInterval\(loadActionCounts, 30000\)/);
});

test("medication requests use five simplified queues and exclude completed deliveries", async () => {
  const api = await source("api/v1/[...path].js");
  const page = await source("src/pages/AdminRequestPages.jsx");
  const adminClient = await source("src/api/admin.js");
  assert.match(page, /const queueOptions = \[\["new","New"\],\["beneficiary_contacted","Beneficiary contacted"\],\["quote_generated","Quote generated"\],\["urgent","Urgent"\],\["overdue","Overdue"\]\]/);
  assert.match(page, /searchParams\.get\("queue"\) \|\| "new"/);
  assert.doesNotMatch(page, /\["all","All"\]|\["awaiting_review","Awaiting review"\]|\["needs_information","Needs information"\]/);
  assert.match(api, /new: \["submitted", "under_review", "under_pharmacy_review"\]/);
  assert.match(api, /queue === "beneficiary_contacted"[^\n]+!item\.quote[^\n]+note\.kind === "beneficiary_contact"/);
  assert.match(api, /queue === "quote_generated"[^\n]+Boolean\(item\.quote\)/);
  assert.match(api, /WHERE o\.id IS NULL OR o\.status NOT IN \('completed','delivered'\)/);
  assert.doesNotMatch(page, /Request information|informationForm|requestInformation/);
  assert.doesNotMatch(adminClient, /requestInformation/);
});

test("generated quotes replace pre-quote actions and support safe customer-notified revisions", async () => {
  const api = await source("api/v1/[...path].js");
  const requestPage = await source("src/pages/AdminRequestPages.jsx");
  const quotePage = await source("src/pages/AdminQuotePage.jsx");
  const quoteClient = await source("src/api/quotes.js");
  const summary = await source("src/components/AdminQuoteSummary.jsx");
  const transfers = await source("src/pages/AdminTransfersPage.jsx");
  const paymentsClient = await source("src/api/payments.js");
  const router = await source("src/router.jsx");

  assert.match(requestPage, /const hasGeneratedQuote = Boolean\(request\.quote \|\| state\.quote\)/);
  assert.match(requestPage, /!hasGeneratedQuote && <section[^\n]+Update pharmacy status/);
  assert.match(requestPage, /!hasGeneratedQuote && <section[^\n]+Beneficiary contact/);
  assert.doesNotMatch(requestPage, /Request information/);
  assert.match(requestPage, /<AdminQuoteSummary/);
  assert.match(summary, /Quote items|Pharmacy quote/);
  assert.match(summary, /Items subtotal/);
  assert.match(summary, /Quote total/);
  assert.match(summary, />Edit quote</);
  assert.match(summary, /"Delete quote"/);
  assert.match(summary, /Review bank transfer/);
  assert.match(summary, /\/admin\/bank-transfers\//);
  assert.match(transfers, /export function AdminTransferDetailPage/);
  assert.match(transfers, /Approve payment/);
  assert.match(paymentsClient, /get: \(id\).*admin\/bank-transfers/);
  assert.match(router, /path="bank-transfers\/:id"/);

  assert.match(quoteClient, /method: "DELETE"/);
  assert.match(quotePage, /Save changes and notify customer/);
  assert.match(quotePage, /previously sent quote has changed/);
  assert.match(requestPage, /previously sent quote has changed/);

  for (const guard of [
    "Pharmacy status actions are closed after a quote is generated.",
    "Information requests are closed after a quote is generated.",
    "Beneficiary contact actions are closed after a quote is generated.",
  ]) assert.ok(api.includes(guard), `missing post-quote guard: ${guard}`);
  assert.match(api, /quote\.updated/);
  assert.match(api, /quote\.deleted/);
  assert.match(api, /approved_at=null/);
  assert.match(api, /Your Hakim Plus quote has changed/);
  assert.match(api, /Important change to your Hakim Plus quote/);
  assert.match(api, /This quote is locked because payment activity or fulfillment has started/);
  assert.match(api, /has_transfer[^\n]+has_payment[^\n]+has_order/);
  assert.match(api, /SELECT id, transfer_number, status, created_at FROM bank_transfers WHERE quote_id/);
});

test("Google social sign-in cannot reuse the previous Hakim Plus session", async () => {
  const api = await source("api/v1/[...path].js");
  const authContext = await source("src/auth/AuthContext.jsx");
  const socialStart = api.slice(api.indexOf('if (action === "social"'), api.indexOf('if (action === "social-complete"'));
  const socialComplete = api.slice(api.indexOf('if (action === "social-complete"'), api.indexOf('if (action === "session"'));
  assert.match(socialStart, /callAuth\(req, "\/sign-out", \{ method: "POST" \}\)/);
  assert.ok(socialStart.indexOf('"/sign-out"') < socialStart.indexOf('"/sign-in/social"'));
  assert.match(socialStart, /"\/sign-in\/social"[^\n]+forwardCookies: false/);
  assert.doesNotMatch(socialComplete, /forwardCookies: false/);
  assert.match(socialComplete, /get-session\?neon_auth_session_verifier/);
  assert.match(api, /res\.setHeader\("Set-Cookie", \[\.\.\.current, \.\.\.cookies\.map\(normalizeCookie\)\]\)/);
  assert.match(authContext, /has\("neon_auth_session_verifier"\)/);
});

test("payment confirmation and dispatch use one combined customer email", async () => {
  const api = await source("api/v1/[...path].js");
  const transfers = await source("src/pages/AdminTransfersPage.jsx");
  const orders = await source("src/pages/AdminOrderPages.jsx");
  const approval = api.slice(api.indexOf('path[3] === "approve"'), api.indexOf('path[3] === "reject"'));
  const dispatch = api.slice(api.indexOf('path[3] === "dispatch"'), api.indexOf('path[3] === "delivery-confirmation"'));
  assert.match(approval, /sendEmail: false/);
  assert.match(dispatch, /subject: "Payment confirmed and order dispatched"/);
  assert.match(dispatch, /label: "Payment number"/);
  assert.match(dispatch, /label: "Order number"/);
  assert.match(transfers, /combined payment-confirmed\/order-dispatched email will be sent when the order is dispatched/);
  assert.match(orders, /send the combined payment-confirmed\/order-dispatched email/);
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

test("transactional emails include event details without the removed reply warning", async () => {
  const api = await source("api/v1/[...path].js");
  assert.match(api, /function quoteEmailDetails/);
  assert.match(api, /Quote total/);
  assert.match(api, /Message preview/);
  assert.match(api, /Payment number/);
  assert.match(api, /Order number/);
  assert.match(api, /Payment receipt received/);
  assert.match(api, /Your quote is ready — payment required/);
  assert.match(api, /"Pay now", \{ sendEmail: false \}/);
  assert.doesNotMatch(api, /Do not send prescriptions or sensitive medical details by replying to this email/);
  const quoteEmail = api.slice(api.indexOf("function quoteEmailDetails"), api.indexOf("function renderEmailDetails"));
  assert.doesNotMatch(quoteEmail, /(Request|Quote|Transfer) number/);
});

test("admin actions confirm before triggering customer email", async () => {
  const requestPage = await source("src/pages/AdminRequestPages.jsx");
  const quotePage = await source("src/pages/AdminQuotePage.jsx");
  const transferPage = await source("src/pages/AdminTransfersPage.jsx");
  const orderPage = await source("src/pages/AdminOrderPages.jsx");
  for (const prompt of [
    "Send this message and an email preview to the customer?",
    "Mark this request unable to fulfill and email the customer?",
    "Cancel this medication request and email the customer?",
  ]) assert.ok(requestPage.includes(`window.confirm("${prompt}")`), `missing confirmation: ${prompt}`);
  assert.match(quotePage, /window\.confirm\("Send this quote and an email to the customer\?/);
  assert.match(transferPage, /creates the fulfillment order/);
  assert.match(transferPage, /Reject this transfer and email the reason to the customer/);
  for (const prompt of ["mark this order completed, and email the customer", "send the combined payment-confirmed/order-dispatched email", "delivery failure and email the customer"]) assert.ok(orderPage.includes(prompt), `missing order email confirmation: ${prompt}`);
});

test("customer request filters use accurate empty-state guidance", async () => {
  const requestPage = await source("src/pages/RequestPages.jsx");
  for (const copy of [
    "No medication requests yet",
    "No active requests",
    "Nothing needs your attention",
    "No completed requests",
    "No cancelled requests",
    "No matching requests",
    "review a quote, make a payment, or provide information",
    "Cancelled requests and requests Hakim Plus could not fulfill",
  ]) assert.ok(requestPage.includes(copy), `missing request empty-state copy: ${copy}`);
  assert.match(requestPage, /const emptyState = appliedSearch/);
  assert.match(requestPage, /emptyState\.actionLabel && <Link/);
  assert.doesNotMatch(requestPage, /You haven&apos;t submitted a medication request yet/);
});
