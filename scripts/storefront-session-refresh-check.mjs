/**
 * Focused headed verification of the storefront session auto-refresh fix:
 * after the 15-minute access token is removed, a signed-in customer must stay
 * signed in (the client transparently refreshes and retries) instead of being
 * bounced to "Sign in".
 *
 * Usage:
 *   node scripts/storefront-session-refresh-check.mjs                  # headless
 *   PCX_HEADED=1 node scripts/storefront-session-refresh-check.mjs --evidence
 *
 * Requires the local dev stack (npm run dev) and seeded demo data
 * (npm run seed:demo). Development verification aid only; never run in prod.
 */
import { chromium } from "playwright";
import { writeEvidence } from "./browser-verify-evidence.mjs";

const BASE_WEB = process.env.PCX_WEB_ORIGIN ?? "http://localhost:3000";
const CUSTOMER = { contact: "demo-customer@example.com", pass: "DemoCustomer1!" };
const headed = process.env.PCX_HEADED === "1";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? "✔" : "✖"} [session/${name}]${detail ? ` ${detail}` : ""}\n`);
}

async function main() {
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 350 : 0 });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  let refreshed = false;
  page.on("response", (resp) => {
    if (resp.request().method() === "POST" && resp.url().includes("/api/v1/auth/refresh")) {
      refreshed = resp.status() === 200;
    }
  });

  const signedIn = async () => {
    try {
      await page.waitForFunction(() => document.body && document.body.innerText.includes("Sign out"), { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  };

  try {
    // Sign in as the demo customer.
    await page.goto(`${BASE_WEB}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await page.getByLabel("Email or phone").fill(CUSTOMER.contact);
    await page.getByLabel("Password", { exact: true }).fill(CUSTOMER.pass);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForLoadState("networkidle");
    record("customer-login", await signedIn(), "signed in (Sign out visible)");

    // Simulate the 15-minute access-token expiry by removing only the access
    // cookie; the refresh cookie stays, which is exactly what auto-refresh needs.
    await page.context().clearCookies({ name: "pcx_access" });

    // Reload: StorefrontNav calls /me, gets 401, auto-refreshes, and retries.
    await page.goto(`${BASE_WEB}/`, { waitUntil: "networkidle", timeout: 30000 });
    record("session-survives-access-expiry", await signedIn(), "still signed in after access cookie removed");
    record("refresh-called", refreshed, "POST /api/v1/auth/refresh observed");
  } catch (e) {
    record("flow", false, e.message);
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);

  if (process.argv.includes("--evidence")) {
    await writeEvidence({
      scope: "Storefront session auto-refresh (fix for repeated logouts)",
      headed,
      tool: "scripts/storefront-session-refresh-check.mjs",
      result: failed.length === 0 ? "passed" : "failed",
      businessFlow: {
        subject: "Signed-in customer stays signed in after the 15-minute access token expires (client auto-refreshes and retries)",
        steps: results.map((r) => r.name)
      }
    });
  }

  process.stdout.write(`\nstorefront-session-refresh: ${results.length - failed.length}/${results.length} passed\n`);
  if (failed.length) {
    for (const r of failed) process.stderr.write(`  ✖ ${r.name}: ${r.detail}\n`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  process.stderr.write(`storefront-session-refresh failed: ${e?.message ?? String(e)}\n`);
  process.exitCode = 1;
});
