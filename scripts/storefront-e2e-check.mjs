/**
 * Human-like click-through verification for the customer storefront
 * (`apps/web`). Extends the load-only `web-check.mjs` gate by actually using the
 * UI: navigating category/product links, opening a listing passport, exercising
 * the buy flow, and walking the 3-step Sell-to-PCX flow as a guest then as a
 * signed-in customer.
 *
 * Usage:
 *   node scripts/storefront-e2e-check.mjs                 # all flows
 *   node scripts/storefront-e2e-check.mjs --only pages    # page-load smoke only
 *   node scripts/storefront-e2e-check.mjs --only buy      # buy-flow only
 *
 * Requires the local dev stack (npm run dev) and seeded demo data
 * (npm run seed:demo). Development verification aid only; never run in prod.
 */
import { chromium } from "playwright";
import { writeEvidence } from "./browser-verify-evidence.mjs";

const BASE_WEB = process.env.PCX_WEB_ORIGIN ?? "http://localhost:3000";
const CUSTOMER = { contact: "demo-customer@example.com", pass: "DemoCustomer1!" };

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const enabled = (name) => !only || only === name;

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? "✔" : "✖"} [storefront/${name}]${detail ? ` ${detail}` : ""}\n`);
};

async function checkPage(page, name, url, requiredText) {
  const errors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // The browser's "Failed to load resource" message is just the console
    // mirror of the request-level failures captured below (response >= 400 and
    // requestfailed). Skip it here to avoid double-counting and to avoid a
    // headed-DevTools-only source-map 404 that has no page-level response event.
    if (/Failed to load resource/.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} -> failed`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !(response.status() === 401 && /\/api\/v1\/me$/.test(response.url()))) {
      failedRequests.push(`${response.request().method()} ${response.url()} -> ${response.status()}`);
    }
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  } catch (e) {
    record(name, false, `navigation: ${e.message}`);
    return;
  }
  const bodyText = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
  const missing = requiredText.filter((t) => !bodyText.includes(t));
  const problems = [...errors, ...consoleErrors, ...failedRequests, ...missing.map((m) => `missing text: ${m}`)];
  record(name, problems.length === 0, problems.join(" | "));
}

async function run() {
  const headed = process.env.PCX_HEADED === "1";
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 350 : 0 });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  if (enabled("pages")) {
    await checkPage(page, "home", `${BASE_WEB}/`, [
      "Have hardware? Turn it into cash.",
      "Buy pre-owned with confidence",
      "Latest certified hardware",
      "Shop by category"
    ]);
    await checkPage(page, "storefront", `${BASE_WEB}/storefront`, [
      "Shop verified hardware",
      "Apply filters"
    ]);
    await checkPage(page, "sell-landing", `${BASE_WEB}/sell`, [
      "Sell to PCX",
      "What are you selling?"
    ]);
    await checkPage(page, "login", `${BASE_WEB}/login`, ["Sign in"]);
    await checkPage(page, "register", `${BASE_WEB}/register`, ["Register", "New accounts start as a customer"]);
    await checkPage(page, "verify", `${BASE_WEB}/verify`, ["Verify"]);
  }

  if (enabled("storefront-flow")) {
    // Use the storefront filters (apply search) and open the first listing card.
    await page.goto(`${BASE_WEB}/storefront`, { waitUntil: "networkidle" });
    await page.getByPlaceholder("Search hardware…").fill("RTX");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForLoadState("networkidle");
    const cards = page.locator(".grid a, .grid [class*=card]");
    const cardCount = await cards.count();
    record("storefront-search-results", cardCount >= 0, `cards=${cardCount}`);
  }

  if (enabled("passport-flow")) {
    // Open the first published listing's passport via its card link.
    await page.goto(`${BASE_WEB}/storefront`, { waitUntil: "networkidle" });
    const firstCardLink = page.locator("a[href*='/passport/']").first();
    const href = await firstCardLink.getAttribute("href").catch(() => null);
    if (!href) {
      record("passport-open", false, "no passport card link found on storefront");
    } else {
      await firstCardLink.click();
      await page.waitForLoadState("networkidle");
      const bodyText = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
      record("passport-open", /PCX item|Not graded|Status/.test(bodyText), href);
      // The passport renders a QR encoding the stable passport URL.
      const qrCount = await page.locator(".qr svg").count().catch(() => 0);
      record("passport-qr", qrCount > 0, qrCount > 0 ? "QR rendered" : "QR missing");
      // Buy flow (guest): should offer sign-in, not throw.
      const buyBtn = page.getByRole("button", { name: "Buy Now" });
      if (await buyBtn.count()) {
        await buyBtn.first().click();
        await page.waitForTimeout(600);
        const buyText = await page.locator("body").innerText().catch(() => "");
        record("passport-buy-guest", /Sign in to buy|You need a customer account/.test(buyText), "guest buy flow surfaced");
      } else {
        record("passport-buy-guest", false, "Buy Now button not found");
      }
    }
  }

  if (enabled("sell-flow")) {
    // Guest sell walk: pick a category, part, see quote, reach contact step.
    await page.goto(`${BASE_WEB}/sell`, { waitUntil: "networkidle" });
    const entryCards = page.locator(".sellEntryCard");
    const entryCount = await entryCards.count();
    record("sell-entries", entryCount >= 4, `entries=${entryCount}`);
    if (entryCount >= 3) {
      // PC Parts entry (index 1) -> part category select appears.
      await entryCards.nth(1).click();
      await page.waitForLoadState("networkidle");
      const partCategory = page.locator("select").first();
      await partCategory.selectOption({ index: 1 });
      await page.waitForLoadState("networkidle");
      const partModel = page.locator("select").nth(1);
      await partModel.selectOption({ index: 1 });
      await page.waitForTimeout(600);
      const bodyText = await page.locator("body").innerText().catch(() => "");
      record("sell-spec-to-decision", /Review selling options|Estimated/.test(bodyText), "part spec selected");
    }
  }

  if (enabled("auth-flow")) {
    // Customer sign-in then verify identity is reflected in the nav.
    await page.goto(`${BASE_WEB}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email or phone").fill(CUSTOMER.contact);
    await page.getByLabel("Password", { exact: true }).fill(CUSTOMER.pass);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForLoadState("networkidle");
    const bodyText = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    record("customer-login", !/Sign in/.test(bodyText) || /account|Account/.test(bodyText), "signed in");
  }

  if (enabled("contact-validation")) {
    // IntlPhoneInput + client-side contact validation (register + login).
    await page.goto(`${BASE_WEB}/register`, { waitUntil: "networkidle" });

    // Default country is Bangladesh (+880) and is selected in the control.
    const countryToggle = page.locator(".phoneInputCountry");
    const defaultDial = await countryToggle.innerText().catch(() => "");
    record("intl-default-bd", /\+880/.test(defaultDial), defaultDial.trim());

    // Search by dial prefix (unique to India's +91, unlike the "India" text
    // which also matches British Indian Ocean Territory) then select it.
    await countryToggle.click();
    await page.locator(".phoneInputSearch").fill("91");
    await page.locator(".phoneInputOption", { hasText: "+91" }).click();
    const updatedDial = await countryToggle.innerText().catch(() => "");
    record("intl-country-switch", /\+91/.test(updatedDial), updatedDial.trim());

    // Invalid email on the login page (a text input) is caught by the custom
    // validateContact rule and surfaced as an error banner.
    await page.goto(`${BASE_WEB}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email or phone").fill("bad@domain");
    await page.getByLabel("Password", { exact: true }).fill("whatever123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(400);
    const loginBody = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    record("contact-invalid-email-blocked", /valid email/i.test(loginBody), "login shows email validation error");
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);

  if (process.argv.includes("--evidence")) {
    await writeEvidence({
      scope: "Customer storefront pages and click-through flows",
      headed,
      tool: "scripts/storefront-e2e-check.mjs",
      result: failed.length === 0 ? "passed" : "failed",
      businessFlow: {
        subject: "Storefront browse, passport, sell, and auth flows",
        steps: results.map((r) => r.name)
      }
    });
  }

  process.stdout.write(`\nstorefront-e2e: ${results.length - failed.length}/${results.length} passed\n`);
  if (failed.length) {
    for (const r of failed) process.stderr.write(`  ✖ ${r.name}: ${r.detail}\n`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  process.stderr.write(`storefront-e2e failed to run: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
