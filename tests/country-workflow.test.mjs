import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { countryOptions, normalizedCountryProfile } from "../src/profile/countries.js";

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
});

test("customer responses hide internal fulfillment and minor pharmacy events", async () => {
  const api = await source("api/v1/[...path].js");
  assert.match(api, /delete request\.internalNotes/);
  assert.match(api, /delete order\.internalTimeline/);
  assert.match(api, /delete order\.deliveryAssignment/);
  assert.doesNotMatch(api, /await notify\(row\.owner_user_id, "Request updated"/);
  for (const title of ["Request submitted", "Your quote is ready", "Payment required", "Payment confirmed", "Order dispatched", "Order completed", "Delivery needs attention"]) assert.ok(api.includes(`"${title}"`), `missing important notification: ${title}`);
});

test("social auth and dedicated legal pages are wired into registration", async () => {
  const authPage = await source("src/pages/AuthPages.jsx");
  const router = await source("src/router.jsx");
  const legal = await source("src/pages/LegalPages.jsx");
  assert.match(authPage, /Continue with Google/);
  assert.match(authPage, /Continue with Apple/);
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
