/**
 * End-to-end business transaction verification across customer web and admin.
 *
 * Two real transactions are driven through the actual browser UI, with each
 * server-side state change verified before moving on:
 *
 *   A) Sell-to-PCX: seller creates a sell request (web), submits it (DRAFT ->
 *      SUBMITTED), and the admin acquisition queue shows the same request.
 *      (Always re-runnable: each run creates a fresh sell request.)
 *
 *   B) Buy + fulfilment: customer buys a published item (order + COD payment),
 *      then admin creates a shipment, ships it, and delivers it.
 *      (Re-runnable: each run picks the first still-sellable listing; if none
 *       is available, it reports that and skips.)
 *
 * Usage:
 *   node scripts/business-e2e-check.mjs                  # headless (CI-style)
 *   PCX_HEADED=1 node scripts/business-e2e-check.mjs     # visible window
 */
import { chromium } from "playwright";

const headed = process.env.PCX_HEADED === "1";
const WEB = process.env.PCX_WEB_ORIGIN ?? "http://localhost:3000";
const ADMIN = process.env.PCX_ADMIN_ORIGIN ?? "http://localhost:3001";

const SELLER = { contact: "demo-seller@example.com", pass: "DemoSeller12!" };
const CUSTOMER = { contact: "demo-customer@example.com", pass: "DemoCustomer1!" };
const ADMIN_CREDS = { contact: "demo-admin@example.com", pass: "DemoAdmin123!", mfa: "123456" };

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? "✔" : "✖"} [biz/${name}]${detail ? ` ${detail}` : ""}\n`);
}

async function webLogin(page, creds) {
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.locator('input[autocomplete="username"]').fill(creds.contact);
  await page.locator('input[autocomplete="current-password"]').fill(creds.pass);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/v1/auth/login") && r.request().method() === "POST", { timeout: 30_000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click()
  ]);
  await page.waitForFunction(() => document.body && document.body.innerText.includes("Sign out"), { timeout: 15_000 }).catch(() => { });
}

async function adminLogin(page) {
  await page.goto(`${ADMIN}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.locator('input[name="contact"]').fill(ADMIN_CREDS.contact);
  await page.locator('input[name="password"]').fill(ADMIN_CREDS.pass);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/v1/auth/login") && r.request().method() === "POST", { timeout: 30_000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click()
  ]);
  const challenge = page.locator('input[name="credential"]');
  try { await challenge.waitFor({ state: "visible", timeout: 10_000 }); } catch { /* no MFA */ }
  if (await challenge.count()) {
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/v1/auth/verify-mfa") && r.request().method() === "POST", { timeout: 30_000 }),
      (async () => { await challenge.fill(ADMIN_CREDS.mfa); await page.getByRole("button", { name: "Verify", exact: true }).click(); })()
    ]);
  }
  await page.waitForFunction(() => document.body && document.body.innerText.includes("Operations dashboard"), { timeout: 15_000 });
}

async function pageFetchJson(page, path, { method = "GET", body } = {}) {
  return page.evaluate(async ({ path, method, body }) => {
    const m = document.cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith("pcx_csrf="));
    const token = m ? decodeURIComponent(m.slice("pcx_csrf=".length)) : null;
    const res = await fetch(path, {
      method,
      headers: {
        accept: "application/json",
        ...(body != null ? { "content-type": "application/json" } : {}),
        ...(token ? { "x-csrf-token": token } : {})
      },
      credentials: "include",
      body: body == null ? undefined : JSON.stringify(body)
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, { path, method, body });
}

async function main() {
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 220 : 0 });
  const webCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminCtx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  const web = await webCtx.newPage();
  const admin = await adminCtx.newPage();

  // ===================== Phase A: Sell request =====================
  await webLogin(web, SELLER);

  const sellCreateResp = web.waitForResponse(
    (r) => r.url().endsWith("/api/v1/sell-requests") && r.request().method() === "POST",
    { timeout: 30_000 }
  );
  await web.goto(`${WEB}/sell`, { waitUntil: "networkidle", timeout: 30_000 });
  await web.locator(".sellEntryCard").nth(1).click(); // PC Parts
  await web.locator("select").first().waitFor({ state: "visible", timeout: 15_000 });
  await web.locator("select").first().selectOption({ index: 1 });
  // Wait until the part-model select is actually populated (the models load via
  // a category-scoped API call after the category is chosen).
  await web.waitForFunction(() => {
    const selects = document.querySelectorAll("select");
    return selects.length >= 2 && selects[1].options.length > 1;
  }, { timeout: 15_000 });
  await web.locator("select").nth(1).selectOption({ index: 1 });
  await web.waitForFunction(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /Review selling options/.test(b.textContent ?? ""));
    return btn && !btn.disabled;
  }, { timeout: 15_000 });
  await web.getByRole("button", { name: /Review selling options/ }).click();
  await web.getByText("How would you like to sell?").waitFor({ state: "visible", timeout: 15_000 });
  await web.getByRole("button", { name: /Sell to PCX/ }).click();
  await web.getByText("Contact & fulfilment").waitFor({ state: "visible", timeout: 15_000 });
  const nameInput = web.locator('label:has-text("Your name") input').first();
  if (await nameInput.count()) await nameInput.fill("Demo Seller");
  await web.getByRole("button", { name: /Submit sell request/ }).click();

  const sellCreated = await sellCreateResp;
  const sellCreatedJson = await sellCreated.json().catch(() => null);
  const sellRequestId = sellCreatedJson?.data?.id ?? null;
  const sellRequestNo = sellCreatedJson?.data?.publicRequestNo ?? null;
  rec("sell-request-created", !!sellRequestId, sellRequestId ? `no=${sellRequestNo ?? "n/a"}` : `http ${sellCreated.status()}`);

  if (sellRequestId) {
    const submitRes = await pageFetchJson(web, `/api/v1/sell-requests/${encodeURIComponent(sellRequestId)}/submit`, { method: "POST", body: {} });
    const listRes = await pageFetchJson(web, "/api/v1/sell-requests");
    const mine = (listRes.body?.data ?? []).find((r) => r.id === sellRequestId);
    rec("sell-request-submitted", submitRes.status === 200 && mine?.status === "SUBMITTED", `status=${mine?.status ?? "missing"}`);

    await adminLogin(admin);
    await admin.goto(`${ADMIN}/acquisition`, { waitUntil: "networkidle", timeout: 30_000 });
    const queueText = await admin.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const marker = sellRequestNo ?? sellRequestId.slice(0, 8);
    rec("sell-request-admin-visible", queueText.includes(marker), queueText.includes("SUBMITTED") ? "SUBMITTED pill present" : "SUBMITTED pill missing");
  }

  // ===================== Phase B: Buy + fulfilment (self-provisioned) ========
  // A demo listing can only be bought once (unique physical item invariant), so
  // this phase provisions a fresh sellable item through the real admin UI each
  // run: inventory intake → listing draft → price → publish, then buys it on the
  // storefront and fulfils it via the admin shipment workspace.
  const MODEL_ID = "82000000-0000-0000-0000-000000000006"; // RTX 3060 demo model
  const runTag = `${Date.now()}`;
  const serial = `E2E-SN-${runTag}`;
  const slug = `e2e-item-${runTag}`;

  await adminLogin(admin);

  // 1) Inventory intake (admin UI).
  let inventoryItemId = null;
  let pcxItemId = null;
  const intakeResp = admin.waitForResponse(
    (r) => r.url().endsWith("/api/v1/admin/inventory") && r.request().method() === "POST",
    { timeout: 30_000 }
  );
  await admin.goto(`${ADMIN}/inventory`, { waitUntil: "networkidle", timeout: 30_000 });
  await admin.locator('input[name="productModelId"]').fill(MODEL_ID);
  await admin.locator('input[name="serial"]').fill(serial);
  await admin.getByRole("button", { name: "Register item" }).click();
  const intakeCreated = await intakeResp;
  const intakeJson = await intakeCreated.json().catch(() => null);
  // Intake returns { item, identifiers } (repository shape).
  inventoryItemId = intakeJson?.data?.item?.id ?? null;
  pcxItemId = intakeJson?.data?.item?.pcxItemId ?? null;
  rec("provision-intake", !!inventoryItemId, inventoryItemId ? `pcx=${pcxItemId ?? "n/a"}` : `http ${intakeCreated.status()}`);

  // 2) Listing draft (admin UI).
  let listingId = null;
  if (inventoryItemId) {
    const draftResp = admin.waitForResponse(
      (r) => r.url().endsWith("/api/v1/admin/listings") && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await admin.goto(`${ADMIN}/listings`, { waitUntil: "networkidle", timeout: 30_000 });
    await admin.locator('input[name="inventoryItemId"]').fill(inventoryItemId);
    await admin.locator('input[name="publicSlug"]').fill(slug);
    await admin.getByRole("button", { name: "Create draft" }).click();
    const draftCreated = await draftResp;
    const draftJson = await draftCreated.json().catch(() => null);
    listingId = draftJson?.data?.id ?? null;
    rec("provision-listing-draft", !!listingId, listingId ? `listing=${listingId.slice(0, 8)}…` : `http ${draftCreated.status()}`);
  }

  // 3) Set price (admin UI).
  let priced = false;
  if (listingId) {
    // Re-fetch the list so the freshly-created draft (first row by recency) is
    // rendered before its "Set price" action is clicked.
    const priceResp = admin.waitForResponse(
      (r) => r.url().endsWith("/api/v1/admin/listings/prices") && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await admin.goto(`${ADMIN}/listings`, { waitUntil: "networkidle", timeout: 30_000 });
    await admin.getByRole("button", { name: "Set price" }).first().click();
    const priceDialog = admin.getByRole("dialog");
    await priceDialog.locator('input[inputmode="decimal"]').fill("29999");
    await priceDialog.getByRole("button", { name: "Save price" }).click();
    const priceCreated = await priceResp;
    priced = priceCreated.status() === 201;
    rec("provision-listing-price", priced, priced ? "price set" : `http ${priceCreated.status()}`);
  }

  // 4) Publish (admin UI).
  let orderId = null;
  let orderNo = null;
  if (listingId && priced) {
    const publishResp = admin.waitForResponse(
      (r) => r.url().endsWith(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/publish`) && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await admin.goto(`${ADMIN}/listings`, { waitUntil: "networkidle", timeout: 30_000 });
    const publishBtn = admin.getByRole("button", { name: "Publish" }).first();
    await publishBtn.click();
    const pubDialog = admin.getByRole("dialog");
    await pubDialog.locator('input[inputmode="text"]').first().fill(slug);
    await pubDialog.locator('button.primary').click();
    const publishedRes = await publishResp;
    rec("provision-listing-publish", publishedRes.status() === 200, `http ${publishedRes.status()}`);
  }

  if (listingId && priced) {
    // 5) Customer buys the freshly published listing.
    await webLogin(web, CUSTOMER);
    const passportUrl = `${WEB}/passport/${encodeURIComponent(pcxItemId ?? "")}`;
    await web.goto(passportUrl, { waitUntil: "networkidle", timeout: 30_000 });

    const buyBtn = web.getByRole("button", { name: /Buy Now/ }).first();
    if ((await buyBtn.count()) === 0) {
      const passportText = await web.locator("body").innerText().catch(() => "");
      rec("buy-order-created", false, `no Buy Now button; ${passportText.slice(0, 100)}`);
    } else {
      const orderCreateResp = web.waitForResponse(
        (r) => r.url().endsWith("/api/v1/orders") && r.request().method() === "POST",
        { timeout: 30_000 }
      );
      await buyBtn.click();
      const orderCreated = await orderCreateResp;
      const orderJson = await orderCreated.json().catch(() => null);
      orderId = orderJson?.data?.id ?? null;
      orderNo = orderJson?.data?.orderNo ?? orderJson?.data?.order_no ?? null;
      rec("buy-order-created", !!orderId, orderId ? `no=${orderNo ?? "n/a"}` : `http ${orderCreated.status()} ${orderJson?.error?.code ?? ""} ${orderJson?.error?.message ?? ""}`);
    }
  }

  // 6) Admin shipment: create → ship → deliver.
  if (orderId) {
    await admin.goto(`${ADMIN}/shipment`, { waitUntil: "networkidle", timeout: 30_000 });

    const shipCreateResp = admin.waitForResponse(
      (r) => r.url().endsWith("/api/v1/admin/shipments") && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await admin.locator('input[name="orderId"]').fill(orderId);
    await admin.locator('input[name="courier"]').fill("Pathao");
    await admin.locator('input[name="packageType"]').fill("box");
    await admin.locator('input[name="weight"]').fill("2.5");
    await admin.getByRole("button", { name: "Create shipment" }).click();
    const shipCreated = await shipCreateResp;
    const shipJson = await shipCreated.json().catch(() => null);
    const shipmentId = shipJson?.data?.id ?? null;
    rec("shipment-created-draft", !!shipmentId, shipmentId ? `shipment=${shipmentId.slice(0, 8)}…` : `http ${shipCreated.status()} ${JSON.stringify(shipJson).slice(0, 120)}`);

    if (shipmentId) {
      // Mark shipped (scope to the "Mark shipped" form).
      const shipForm = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Mark shipped" }) });
      const shipResp = admin.waitForResponse(
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
      rec("shipment-marked-shipped", shipped.status() === 200 && shippedJson?.data?.status === "SHIPPED", shippedJson?.data?.trackingId ? `tracking=${shippedJson.data.trackingId}` : `http ${shipped.status()}`);

      // Mark delivered (scope to the "Mark delivered" form).
      const deliverForm = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Mark delivered" }) });
      const deliverResp = admin.waitForResponse(
        (r) => r.url().endsWith(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/deliver`) && r.request().method() === "POST",
        { timeout: 30_000 }
      );
      await deliverForm.locator('input[name="shipmentId"]').fill(shipmentId);
      await deliverForm.getByRole("button", { name: "Mark delivered" }).click();
      const delivered = await deliverResp;
      const deliveredJson = await delivered.json().catch(() => null);
      rec("shipment-marked-delivered", delivered.status() === 200 && deliveredJson?.data?.status === "DELIVERED", `http ${delivered.status()}`);
    }
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  process.stdout.write(`\nbusiness-e2e: ${results.length - failed.length}/${results.length} passed\n`);
  if (failed.length) {
    for (const r of failed) process.stderr.write(`  ✖ ${r.name}: ${r.detail}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`business-e2e failed to run: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
