/**
 * Real-browser verification for the customer web and admin web apps.
 *
 * Launches headless Chromium via Playwright and loads the key public/admin
 * pages, capturing client-side failures that a plain `curl`-style HTTP 200
 * check cannot see:
 *   - uncaught page errors (React runtime errors surface here)
 *   - console.error output
 *   - failed network requests (4xx/5xx from the API through the Next.js proxy)
 *
 * Usage:
 *   node scripts/web-check.mjs                 # all checks
 *   node scripts/web-check.mjs --only web      # only customer web
 *   node scripts/web-check.mjs --only admin    # only admin
 *
 * Requires the local dev stack to be running (npm run dev). This is a
 * development verification aid, not a production test.
 */
import { chromium } from "playwright";

const BASE_WEB = process.env.PCX_WEB_ORIGIN ?? "http://localhost:3000";
const BASE_ADMIN = process.env.PCX_ADMIN_ORIGIN ?? "http://localhost:3001";

const CHECKS = [
  {
    group: "web",
    name: "home",
    url: `${BASE_WEB}/`,
    selectors: ["text=Have hardware? Turn it into cash.", "text=Buy pre-owned with confidence", "text=Latest certified hardware", "text=Shop by category"]
  },
  {
    group: "web",
    name: "storefront",
    url: `${BASE_WEB}/storefront`,
    selectors: ["text=Shop verified hardware"]
  },
  {
    group: "web",
    name: "sell",
    url: `${BASE_WEB}/sell`,
    selectors: ["text=Sell to PCX"]
  },
  {
    group: "admin",
    name: "acquisition",
    url: `${BASE_ADMIN}/acquisition`,
    // A signed-out visit gracefully redirects to /login; either the workspace
    // or the login page is healthy, as long as no client-side error is thrown.
    selectors: ["text=Sign in"]
  }
];

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

// A signed-out guest legitimately gets 401 from the auth-minded `/me` probe and
// the browser logs a matching "Failed to load resource" console.error. That is
// the expected pre-auth state, not a regression.
const isExpectedGuest401 = (url) => /\/api\/v1\/me$/.test(url);

function buildFailures({ errors, consoleErrors, failedRequests, missingSelectors }) {
  const lines = [];
  for (const e of errors) lines.push(`pageerror: ${e}`);
  for (const e of consoleErrors) lines.push(`console.error: ${e}`);
  for (const r of failedRequests) lines.push(`failed request: ${r.method ?? "GET"} ${r.url} -> ${r.status}`);
  for (const s of missingSelectors) lines.push(`missing selector: ${s}`);
  return lines;
}

async function run() {
  const browser = await chromium.launch();
  const targets = only ? CHECKS.filter((c) => c.group === only || c.name === only) : CHECKS;
  const results = [];
  let failed = false;

  for (const check of targets) {
    const page = await browser.newPage();
    const errors = [];
    const consoleErrors = [];
    const failedRequests = [];

    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // Browser's resource-load error for the expected signed-out `/me` 401.
      if (/Failed to load resource:.*401/.test(text)) return;
      consoleErrors.push(text);
    });
    page.on("requestfailed", (request) => failedRequests.push({ method: request.method(), url: request.url(), status: "failed" }));
    page.on("response", (response) => {
      if (response.status() >= 400 && !(response.status() === 401 && isExpectedGuest401(response.url()))) {
        failedRequests.push({ method: response.request().method(), url: response.url(), status: response.status() });
      }
    });

    let missingSelectors = [];
    try {
      await page.goto(check.url, { waitUntil: "networkidle", timeout: 30_000 });
      const bodyText = await page.locator("body").innerText({ timeout: 15_000 });
      missingSelectors = check.selectors.filter((selector) => {
        if (selector.startsWith("text=")) return !bodyText.includes(selector.slice("text=".length));
        return false;
      });
    } catch (error) {
      errors.push(`navigation: ${error.message}`);
    }

    const failures = buildFailures({ errors, consoleErrors, failedRequests, missingSelectors });
    const ok = failures.length === 0;
    results.push({ group: check.group, name: check.name, url: check.url, ok, failures });
    if (!ok) failed = true;
    await page.close();
  }

  await browser.close();

  for (const result of results) {
    if (result.ok) {
      process.stdout.write(`✔ [${result.group}/${result.name}] ${result.url}\n`);
    } else {
      process.stdout.write(`✖ [${result.group}/${result.name}] ${result.url}\n`);
      for (const line of result.failures) process.stdout.write(`    - ${line}\n`);
    }
  }

  if (failed) {
    process.stderr.write("web-check failed: client-side errors or missing content detected\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(`web-check passed: ${results.length} page(s) verified with no client-side errors\n`);
  }
}

run().catch((error) => {
  process.stderr.write(`web-check failed to run: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
