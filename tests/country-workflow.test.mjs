import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { countryOptions, normalizedCountryProfile } from "../src/profile/countries.js";
import { emailError, isPlausibleEmail, isPlausiblePhone, phoneError } from "../src/validation/contact.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the country catalog is complete and maps registration countries to ISO currencies", () => {
  assert.ok(countryOptions.length >= 249);
  for (const [code, currency] of [["US", "USD"], ["GB", "GBP"], ["CA", "CAD"], ["DE", "EUR"], ["AE", "AED"], ["ET", "ETB"]]) {
    assert.equal(normalizedCountryProfile(code)?.currency, currency);
  }
});

test("country and currency are authoritative backend profile fields", async () => {
  const api = await source("api/v1/[...path].js");
  const countries = await source("src/profile/countries.js");
  const quotePage = await source("src/pages/AdminQuotePage.jsx");
  assert.match(api, /normalizedCountryProfile\(form\.countryCode/);
  assert.match(countries, /countryCode: country\.code/);
  assert.match(api, /data\.currency = expectedCurrency/);
  assert.match(api, /amount_minor integer NOT NULL, currency text NOT NULL/);
  assert.match(quotePage, /Set by the customer&apos;s country profile/);
  assert.match(quotePage, /value=\{quote\.currency\} disabled/);
});

test("customer tracking has four stages while fulfillment exposes only delivery outcomes", async () => {
  const tracker = await source("src/components/CustomerOrderTracker.jsx");
  const customerRequests = await source("src/pages/RequestPages.jsx");
  const adminOrders = await source("src/pages/AdminOrderPages.jsx");
  const api = await source("api/v1/[...path].js");
  for (const label of ["Request Submitted", "Pharmacy Review", "Payment", "Delivery"]) assert.ok(tracker.includes(label));
  assert.equal((tracker.match(/label:/g) || []).length, 4);
  assert.doesNotMatch(adminOrders, /value="preparing_order"|value="ready_for_delivery"/);
  assert.match(adminOrders, /Out for Delivery/);
  assert.match(adminOrders, /Completed/);
  assert.match(adminOrders, /Delivery Failed/);
  assert.match(api, /Use dispatch, delivery confirmation, or delivery failure/);
  assert.match(api, /saveOrderState\(row, "completed"/);
  assert.match(api, /const completed = \["completed", "delivered"\]\.includes\(internalStatus\)/);
  assert.match(api, /request\.statusLabel = completed \? "Completed"/);
  assert.match(api, /request\.latestUpdate = completed \? completionMessage/);
  assert.match(api, /Your request is complete and the order has been delivered\./);
  assert.match(api, /status='completed', status_history=status_history \|\|/);
  assert.match(customerRequests, /request\.completed && <section/);
  assert.match(customerRequests, /Order delivered/);
  assert.match(customerRequests, /View completed order/);
  assert.match(customerRequests, /!request\.completed && <section/);
  assert.match(adminOrders, /function DeliveryPersonSummary/);
  assert.match(adminOrders, /Edit delivery person/);
  assert.match(adminOrders, /Save changes/);
  assert.match(adminOrders, /order\.deliveryAssignment && !editingAssignment/);
  assert.match(api, /\["payment_confirmed", "delivery_failed", "out_for_delivery"\]\.includes\(row\.status\)/);
});

test("customer responses hide internal fulfillment and minor pharmacy events", async () => {
  const api = await source("api/v1/[...path].js");
  assert.match(api, /delete request\.internalNotes/);
  assert.match(api, /delete order\.internalTimeline/);
  assert.match(api, /delete order\.deliveryAssignment/);
  assert.doesNotMatch(api, /await notify\(row\.owner_user_id, "Request updated"/);
  for (const title of ["Request submitted", "Your quote is ready", "Payment required", "Payment confirmed", "Order dispatched", "Order completed", "Delivery needs attention"]) assert.ok(api.includes(`"${title}"`), `missing important notification: ${title}`);
});

test("Google auth and dedicated legal pages are wired into registration", async () => {
  const authPage = await source("src/pages/AuthPages.jsx");
  const authClient = await source("src/auth/authClient.js");
  const authContext = await source("src/auth/AuthContext.jsx");
  const api = await source("api/v1/[...path].js");
  const router = await source("src/router.jsx");
  const legal = await source("src/pages/LegalPages.jsx");
  assert.match(authPage, /Continue with Google/);
  assert.doesNotMatch(authPage, /Continue with Apple/);
  assert.match(authPage, /<SocialAuthButtons disabled={!auth\.configured}/);
  assert.match(api, /provider !== "google"/);
  assert.match(api, /headers\["x-neon-auth-middleware"\] = "true"/);
  assert.match(api, /action === "social-complete"/);
  assert.match(authClient, /completeSocialSignIn/);
  assert.match(router, /neon_auth_session_verifier/);
  assert.match(authContext, /const refreshSession = useCallback/);
  assert.doesNotMatch(authPage, /\[auth, navigate, oauthError, verifier\]/);
  assert.match(authPage, /By creating an account, you agree to our/);
  assert.match(router, /path="\/terms"/);
  assert.match(router, /path="\/privacy"/);
  assert.match(legal, /Terms of Use/);
  assert.match(legal, /Privacy Policy/);
});

test("analytics never combines monetary values across currencies", async () => {
  const api = await source("api/v1/[...path].js");
  const analytics = await source("src/pages/AdminAnalyticsPage.jsx");
  assert.match(api, /GROUP BY p\.currency/);
  assert.match(api, /averageOrderValues/);
  assert.match(analytics, /Average order value by currency/);
  assert.match(analytics, /must not be combined without an exchange-rate ledger/);
});

test("contact validation rejects obvious email and phone mistakes", () => {
  assert.equal(isPlausibleEmail("customer@example.com"), true);
  assert.equal(isPlausibleEmail("customer@example"), false);
  assert.equal(isPlausibleEmail("customer@@example.com"), false);
  assert.equal(isPlausiblePhone("+251 911 234 567"), true);
  assert.equal(isPlausiblePhone("+1 (202) 555-0123"), true);
  assert.equal(isPlausiblePhone("phone-number"), false);
  assert.equal(isPlausiblePhone("1111111111"), false);
  assert.match(emailError("bad"), /valid email address/);
  assert.match(phoneError("123"), /7 to 15 digits/);
});

test("mobile account navigation and analytics drill-downs expose requested detail", async () => {
  const portal = await source("src/layouts/PortalLayout.jsx");
  const api = await source("api/v1/[...path].js");
  const analytics = await source("src/pages/AdminAnalyticsPage.jsx");
  const governance = await source("src/api/governance.js");
  assert.match(portal, /overflow-x-auto/);
  assert.match(portal, /navigation\.map/);
  assert.match(portal, />Log out<\/button>/);
  assert.match(api, /path\[2\] === "customers"/);
  assert.match(api, /path\[2\] === "beneficiaries"/);
  assert.match(api, /new_customers/);
  assert.match(governance, /analytics\/customers/);
  assert.match(governance, /analytics\/beneficiaries/);
  assert.match(analytics, /Customer directory/);
  assert.match(analytics, /Beneficiary directory/);
  assert.match(analytics, /New users/);
});
