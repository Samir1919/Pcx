/**
 * Focused shipment fulfilment flow against an existing order that has no
 * shipment. Signs in to admin, creates a shipment for the given order, marks it
 * shipped (server-authoritative tracking id), then marks it delivered.
 *
 * Usage:
 *   ORDER_ID=<uuid> node scripts/shipment-flow-check.mjs
 *   PCX_HEADED=1 ORDER_ID=<uuid> node scripts/shipment-flow-check.mjs
 */
import { chromium } from "playwright";

const headed = process.env.PCX_HEADED === "1";
const ADMIN = process.env.PCX_ADMIN_ORIGIN ?? "http://localhost:3001";
const ADMIN_CREDS = { contact: "demo-admin@example.com", pass: "DemoAdmin123!", mfa: "123456" };
const orderId = process.env.ORDER_ID;

if (!orderId) {
  process.stderr.write("ORDER_ID env is required\n");
  process.exit(1);
}

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? "✔" : "✖"} [ship/${name}]${detail ? ` ${detail}` : ""}\n`);
}

const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 220 : 0 });
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });

try {
  // Admin login + MFA.
  await page.goto(`${ADMIN}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.locator('input[name="contact"]').fill(ADMIN_CREDS.contact);
  await page.locator('input[name="password"]').fill(ADMIN_CREDS.pass);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/v1/auth/login") && r.request().method() === "POST", { timeout: 30_000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click()
  ]);
  const challenge = page.locator('input[name="credential"]');
  try { await challenge.waitFor({ state: "visible", timeout: 10_000 }); } catch { }
  if (await challenge.count()) {
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/v1/auth/verify-mfa") && r.request().method() === "POST", { timeout: 30_000 }),
      (async () => { await challenge.fill(ADMIN_CREDS.mfa); await page.getByRole("button", { name: "Verify", exact: true }).click(); })()
    ]);
  }
  await page.waitForFunction(() => document.body && document.body.innerText.includes("Operations dashboard"), { timeout: 15_000 });

  await page.goto(`${ADMIN}/shipment`, { waitUntil: "networkidle", timeout: 30_000 });

  // Create shipment.
  const createResp = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/admin/shipments") && r.request().method() === "POST",
    { timeout: 30_000 }
  );
  await page.locator('input[name="orderId"]').fill(orderId);
  await page.locator('input[name="courier"]').fill("Pathao");
  await page.locator('input[name="packageType"]').fill("box");
  await page.locator('input[name="weight"]').fill("2.5");
  await page.getByRole("button", { name: "Create shipment" }).click();
  const created = await createResp;
  const createdJson = await created.json().catch(() => null);
  const shipmentId = createdJson?.data?.id ?? null;
  rec("create", !!shipmentId, shipmentId ? `shipment=${shipmentId.slice(0, 8)}…` : `http ${created.status()} ${JSON.stringify(createdJson).slice(0, 120)}`);

  if (shipmentId) {
    // Mark shipped (scope to the "Mark shipped" form).
    const shipForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Mark shipped" }) });
    const shipResp = page.waitForResponse(
      (r) => r.url().endsWith(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/ship`) && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await shipForm.locator('input[name="shipmentId"]').fill(shipmentId);
    await shipForm.locator('input[name="recipientName"]').fill("Demo Customer");
    await shipForm.locator('input[name="phone"]').fill("+8801700000002");
    await shipForm.locator('input[name="line1"]').fill("House 12, Road 5");
    await shipForm.locator('input[name="city"]').fill("Dhaka");
    await shipForm.locator('input[name="postalCode"]').fill("1209");
    await shipForm.getByRole("button", { name: "Mark shipped" }).click();
    const shipped = await shipResp;
    const shippedJson = await shipped.json().catch(() => null);
    const shippedOk = shipped.status() === 200 && shippedJson?.data?.status === "SHIPPED";
    rec("shipped", shippedOk, shippedOk ? `tracking=${shippedJson?.data?.trackingId ?? "n/a"}` : `http ${shipped.status()} ${JSON.stringify(shippedJson).slice(0, 120)}`);

    // Mark delivered (scope to the "Mark delivered" form).
    const deliverForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Mark delivered" }) });
    const deliverResp = page.waitForResponse(
      (r) => r.url().endsWith(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/deliver`) && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await deliverForm.locator('input[name="shipmentId"]').fill(shipmentId);
    await deliverForm.getByRole("button", { name: "Mark delivered" }).click();
    const delivered = await deliverResp;
    const deliveredJson = await delivered.json().catch(() => null);
    rec("delivered", delivered.status() === 200 && deliveredJson?.data?.status === "DELIVERED", `http ${delivered.status()}`);
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
process.stdout.write(`\nshipment-flow: ${results.length - failed.length}/${results.length} passed\n`);
if (failed.length) {
  for (const r of failed) process.stderr.write(`  ✖ ${r.name}: ${r.detail}\n`);
  process.exitCode = 1;
}
