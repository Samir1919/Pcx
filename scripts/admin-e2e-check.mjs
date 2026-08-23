/**
 * Human-like click-through verification for the admin web app (`apps/admin`).
 * Signs in with the demo admin (including the development MFA code), then visits
 * every operational workspace page and fails on client-side errors, failed API
 * requests, or missing headings.
 *
 * Usage:
 *   node scripts/admin-e2e-check.mjs
 *
 * Requires the local dev stack (npm run dev) and seeded demo data
 * (npm run seed:demo). Development verification aid only; never run in prod.
 */
import { chromium } from "playwright";

const BASE_ADMIN = process.env.PCX_ADMIN_ORIGIN ?? "http://localhost:3001";
const ADMIN = { contact: "demo-admin@example.com", pass: "DemoAdmin123!", mfa: "123456" };

const PAGES = [
  { path: "/", headings: ["Operations dashboard", "Customers", "Recent orders".toUpperCase(), "Recent sell requests".toUpperCase()] },
  { path: "/catalog", headings: ["Catalog workspace", "Product Models"] },
  { path: "/inventory", headings: ["Inventory", "Register an item"] },
  { path: "/listings", headings: ["Listings", "All listings"] },
  { path: "/acquisition", headings: ["Acquisition", "Admin queue"] },
  { path: "/shipment", headings: ["Shipment", "Recent shipments"] },
  { path: "/returns", headings: ["Returns & refunds", "Recent returns"] },
  { path: "/warranty", headings: ["Warranty & claims", "Recent warranties", "Recent claims"] },
  { path: "/notifications", headings: ["Notifications", "Recent notifications"] },
  { path: "/verification", headings: ["Verification templates", "Inspection templates"] },
  { path: "/payments", headings: ["Payment providers"] },
  { path: "/users", headings: ["Users"] },
  { path: "/footer", headings: ["Site footer"] },
  { path: "/audit", headings: ["Audit logs"] }
];

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? "✔" : "✖"} [admin/${name}]${detail ? ` ${detail}` : ""}\n`);
};

async function run() {
  const headed = process.env.PCX_HEADED === "1";
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 350 : 0 });
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  const page = await context.newPage();

  // Sign in (admin + dev MFA).
  await page.goto(`${BASE_ADMIN}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.locator('input[name="contact"]').fill(ADMIN.contact);
  await page.locator('input[name="password"]').fill(ADMIN.pass);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Wait for either the MFA challenge or a successful redirect to the overview.
  const challenge = page.locator('input[name="credential"]');
  try {
    await Promise.race([
      challenge.waitFor({ state: "visible", timeout: 10_000 }),
      page.waitForFunction(
        () => document.body && document.body.innerText.includes("Operations dashboard"),
        { timeout: 10_000 }
      )
    ]);
  } catch {
    // Fall through; the signed-in assertion below reports the true state.
  }

  if (await challenge.count()) {
    await challenge.fill(ADMIN.mfa);
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForFunction(
      () => document.body && document.body.innerText.includes("Operations dashboard"),
      { timeout: 15_000 }
    );
  }

  const signedIn = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
  if (!/Operations dashboard/.test(signedIn)) {
    record("login", false, `could not sign in as demo admin: ${signedIn.slice(0, 200)}`);
    await browser.close();
    process.exitCode = 1;
    return;
  }
  record("login", true, "authenticated (MFA)");

  for (const p of PAGES) {
    const errors = [];
    const consoleErrors = [];
    const failedRequests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // Browser's request-level failure mirror; counted once via "response" and
      // "requestfailed" below (avoids double-counting and headed DevTools
      // source-map noise).
      if (/Failed to load resource/.test(text)) return;
      consoleErrors.push(text);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} -> failed`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.request().method()} ${response.url()} -> ${response.status()}`);
    });

    try {
      await page.goto(`${BASE_ADMIN}${p.path}`, { waitUntil: "networkidle", timeout: 30_000 });
    } catch (e) {
      record(p.path, false, `navigation: ${e.message}`);
      continue;
    }
    const bodyText = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const missing = p.headings.filter((h) => !bodyText.toUpperCase().includes(h.toUpperCase()));
    const problems = [...errors, ...consoleErrors, ...failedRequests, ...missing.map((m) => `missing: ${m}`)];
    record(p.path, problems.length === 0, problems.join(" | "));
  }

  // --- Interactive workflow checks (human-like use, not just page loads) ---

  // Catalog: open a category edit modal (client-side portal) and dismiss it.
  try {
    await page.goto(`${BASE_ADMIN}/catalog`, { waitUntil: "networkidle", timeout: 30_000 });
    const editButton = page.getByRole("button", { name: "Edit" }).first();
    if (await editButton.count()) {
      await editButton.click();
      await page.waitForTimeout(400);
      const modal = page.getByRole("dialog");
      const modalVisible = await modal.count();
      record("catalog-edit-modal", modalVisible > 0, modalVisible > 0 ? "edit modal opened" : "no dialog");
      if (modalVisible > 0) await page.getByRole("button", { name: "Cancel" }).click();
    } else {
      record("catalog-edit-modal", false, "no Edit button on catalog");
    }
  } catch (e) {
    record("catalog-edit-modal", false, e.message);
  }

  // Inventory: open the Inspect modal for the first item.
  try {
    await page.goto(`${BASE_ADMIN}/inventory`, { waitUntil: "networkidle", timeout: 30_000 });
    const inspectButton = page.getByRole("button", { name: "Inspect" }).first();
    if (await inspectButton.count()) {
      await inspectButton.click();
      await page.waitForTimeout(400);
      const modal = page.getByRole("dialog");
      const visible = await modal.count();
      record("inventory-inspect-modal", visible > 0, visible > 0 ? "inspect modal opened" : "no dialog");
      if (visible > 0) await page.getByRole("button", { name: "Close" }).first().click();
    } else {
      record("inventory-inspect-modal", false, "no Inspect button");
    }
  } catch (e) {
    record("inventory-inspect-modal", false, e.message);
  }

  // Acquisition: open a sell request detail and verify contextual prefill.
  try {
    await page.goto(`${BASE_ADMIN}/acquisition`, { waitUntil: "networkidle", timeout: 30_000 });
    const viewButton = page.getByRole("button", { name: "View" }).first();
    if (await viewButton.count()) {
      await viewButton.click();
      await page.waitForTimeout(400);
      const prefill = await page.locator('input[name="sellRequestId"]').first().inputValue();
      record("acquisition-contextual-prefill", prefill.length > 0, prefill ? `sell request id pre-filled (${prefill.slice(0, 8)}…)` : "no prefill");
    } else {
      record("acquisition-contextual-prefill", false, "no View button");
    }
  } catch (e) {
    record("acquisition-contextual-prefill", false, e.message);
  }

  // Warranty: verify the create-warranty window defaults are pre-filled.
  try {
    await page.goto(`${BASE_ADMIN}/warranty`, { waitUntil: "networkidle", timeout: 30_000 });
    const startsAt = await page.locator('input[name="startsAt"]').first().inputValue();
    const endsAt = await page.locator('input[name="endsAt"]').first().inputValue();
    record("warranty-window-default", startsAt.length > 0 && endsAt.length > 0, startsAt && endsAt ? "window defaulted" : "no default");
  } catch (e) {
    record("warranty-window-default", false, e.message);
  }

  // Acquisition: verify the offer expiry default is pre-filled.
  try {
    await page.goto(`${BASE_ADMIN}/acquisition`, { waitUntil: "networkidle", timeout: 30_000 });
    const expiresAt = await page.locator('input[name="expiresAt"]').first().inputValue();
    record("acquisition-offer-expiry-default", expiresAt.length > 0, expiresAt ? "expiry defaulted" : "no default");
  } catch (e) {
    record("acquisition-offer-expiry-default", false, e.message);
  }

  // Returns: verify the first actionable row button renders (demo returns are REQUESTED → Approve).
  try {
    await page.goto(`${BASE_ADMIN}/returns`, { waitUntil: "networkidle", timeout: 30_000 });
    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    record("returns-row-action", await approveButton.count() > 0, (await approveButton.count()) > 0 ? "row action present" : "no row action");
  } catch (e) {
    record("returns-row-action", false, e.message);
  }

  // Warranty: verify the first actionable claim row renders a Resolve button.
  try {
    await page.goto(`${BASE_ADMIN}/warranty`, { waitUntil: "networkidle", timeout: 30_000 });
    const resolveButton = page.getByRole("button", { name: "Resolve" }).first();
    record("warranty-row-action", await resolveButton.count() > 0, (await resolveButton.count()) > 0 ? "row action present" : "no row action");
  } catch (e) {
    record("warranty-row-action", false, e.message);
  }

  // Listings: open the Photos media modal for the first listing.
  try {
    await page.goto(`${BASE_ADMIN}/listings`, { waitUntil: "networkidle", timeout: 30_000 });
    const photosButton = page.getByRole("button", { name: "Photos" }).first();
    if (await photosButton.count()) {
      await photosButton.click();
      await page.waitForTimeout(400);
      const modal = page.getByRole("dialog");
      const visible = await modal.count();
      record("listings-photos-modal", visible > 0, visible > 0 ? "photos modal opened" : "no dialog");
      if (visible > 0) await page.getByRole("button", { name: "Close" }).first().click();
    } else {
      record("listings-photos-modal", false, "no Photos button");
    }
  } catch (e) {
    record("listings-photos-modal", false, e.message);
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  process.stdout.write(`\nadmin-e2e: ${results.length - failed.length}/${results.length} passed\n`);
  if (failed.length) {
    for (const r of failed) process.stderr.write(`  ✖ ${r.name}: ${r.detail}\n`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  process.stderr.write(`admin-e2e failed to run: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
