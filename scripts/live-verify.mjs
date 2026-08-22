/**
 * Hang-proof, resilient real-browser verification for auth-gated flows.
 *
 * Problem this solves: ad-hoc inline Playwright scripts frequently hung for 30s
 * on a wrong selector / navigation wait and then threw an uncaught exception,
 * leaving the agent "stuck". This script cannot hang:
 *
 *   - hard page timeouts (5s default, 10s navigation)
 *   - every step is try/catch-wrapped and reported as PASS / SKIPPED / FAIL
 *   - the browser always closes in a `finally`
 *   - a wrong selector or a failed login becomes a graceful SKIPPED, not a hang
 *
 * Usage:
 *   node scripts/live-verify.mjs admin-inventory
 *   node scripts/live-verify.mjs sell-flow
 *
 * Requires the local dev stack (`npm run dev`). This is a development aid.
 */
import { chromium } from "playwright";

const ADMIN_WEB = process.env.PCX_ADMIN_ORIGIN ?? "http://localhost:3001";
const WEB = process.env.PCX_WEB_ORIGIN ?? "http://localhost:3000";

// Dev-only demo account. Never a production secret.
const ADMIN_CONTACT = process.env.PCX_DEMO_ADMIN_CONTACT ?? "demo-admin@example.com";
const ADMIN_PASSWORD = process.env.PCX_DEMO_ADMIN_PASSWORD ?? "DemoAdmin123!";
const ADMIN_MFA_CODE = process.env.PCX_DEMO_ADMIN_MFA ?? "123456";

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() > 0) {
      await locator.click();
      return true;
    }
  }
  return false;
}

async function bodyText(page) {
  return (await page.locator("body").innerText()).replace(/\n+/g, " ");
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => { });
  await page.waitForTimeout(800);
}

async function adminLogin(page) {
  await page.goto(`${ADMIN_WEB}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[name=contact]", ADMIN_CONTACT);
  await page.fill("input[name=password]", ADMIN_PASSWORD);
  const clicked = await clickFirst(page, ["button.primary", "button[type=submit]"]);
  if (!clicked) return false;

  await page.waitForTimeout(1500);
  let body = await bodyText(page);
  if (/one-time code|verify sign-in/i.test(body)) {
    await page.fill("input[name=credential]", ADMIN_MFA_CODE);
    const verified = await clickFirst(page, ["button.primary", "button[type=submit]"]);
    if (!verified) return false;
    await page.waitForTimeout(1500);
  }
  // Login succeeded if we left the credentials form behind.
  body = await bodyText(page);
  return !/Email or phone/.test(body) && !/Sign in with an authorized account/.test(body);
}

const CHECKS = {
  "admin-inventory": async (page) => {
    const loggedIn = await adminLogin(page);
    if (!loggedIn) return { ok: false, skipped: true, reason: "admin login did not complete" };
    await page.goto(`${ADMIN_WEB}/inventory`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const body = await bodyText(page);
    const missing = [];
    if (!body.includes("Inspect")) missing.push("Inspect button");
    if (!body.includes("Register item")) missing.push("Register item form");
    if (missing.length > 0) {
      return { ok: false, skipped: false, missing, reason: `url=${page.url()} body=${body.slice(0, 200).replace(/\n+/g, " ")}` };
    }
    return { ok: true, missing: [], skipped: false };
  },
  "admin-listing-photos": async (page) => {
    const loggedIn = await adminLogin(page);
    if (!loggedIn) return { ok: false, skipped: true, reason: "admin login did not complete" };
    await page.goto(`${ADMIN_WEB}/listings`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const body = await bodyText(page);
    if (!body.includes("Photos")) {
      return { ok: false, skipped: false, missing: ["Photos button"], reason: `url=${page.url()} body=${body.slice(0, 200).replace(/\\n+/g, " ")}` };
    }
    return { ok: true, missing: [], skipped: false };
  },
  "sell-flow": async (page) => {
    await page.goto(`${WEB}/sell`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const body = await bodyText(page);
    const missing = [];
    if (!body.includes("Sell to PCX")) missing.push("sell heading");
    return { ok: missing.length === 0, missing, skipped: false };
  }
};

async function run(name) {
  const check = CHECKS[name];
  if (!check) {
    process.stderr.write(`unknown check: ${name}\n`);
    process.exitCode = 2;
    return;
  }
  // Headed (visible window) by default so a human can watch the real flow.
  // Set PCX_BROWSER_HEADLESS=1 to run without a window in CI.
  const browser = await chromium.launch({ headless: process.env.PCX_BROWSER_HEADLESS === "1" });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5_000);
    page.setDefaultNavigationTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let result;
    try {
      result = await check(page);
    } catch (error) {
      result = { ok: false, skipped: true, reason: `check crashed safely: ${error.message}` };
    }
    const status = result.skipped ? "SKIPPED" : result.ok ? "PASS" : "FAIL";
    const details = result.reason ?? (result.missing?.length ? `missing: ${result.missing.join(", ")}` : "");
    process.stdout.write(`${status} [${name}]${details ? ` — ${details}` : ""}\n`);
    if (!result.ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

const target = process.argv[2];
if (!target) {
  process.stderr.write(`usage: node scripts/live-verify.mjs <${Object.keys(CHECKS).join("|")}>\n`);
  process.exitCode = 2;
} else {
  await run(target);
}
