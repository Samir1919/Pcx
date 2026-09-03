/**
 * Headed verification of the admin acquisition continuation flow
 * (offer create -> seller agreed -> acquisition -> mark paid).
 * Usage: PCX_HEADED=1 node scripts/acquisition-flow-e2e-check.mjs --evidence
 */
import { chromium } from "playwright";
import { writeEvidence } from "./browser-verify-evidence.mjs";

const headed = process.env.PCX_HEADED === "1";
const ADMIN = process.env.PCX_ADMIN_ORIGIN ?? "http://localhost:3001";
const ADMIN_CREDS = { contact: "demo-admin@example.com", pass: "DemoAdmin123!", mfa: "123456" };

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? "✔" : "✖"} [acq/${name}]${detail ? ` ${detail}` : ""}\n`);
}

async function adminLogin(page) {
  await page.goto(`${ADMIN}/login`, { waitUntil: "load", timeout: 30000 });
  await page.locator("input[name=contact]").fill(ADMIN_CREDS.contact);
  await page.locator("input[name=password]").fill(ADMIN_CREDS.pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  const challenge = page.locator("input[name=credential]");
  try {
    await Promise.race([
      challenge.waitFor({ state: "visible", timeout: 10000 }),
      page.waitForFunction(() => document.body && document.body.innerText.includes("Operations dashboard"), { timeout: 10000 })
    ]);
  } catch {}
  if (await challenge.count()) {
    await challenge.fill(ADMIN_CREDS.mfa);
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForFunction(() => document.body && document.body.innerText.includes("Operations dashboard"), { timeout: 15000 });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 300 : 0 });
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });

  try {
    await adminLogin(page);
    rec("admin-login", true);
  } catch (e) {
    rec("admin-login", false, e.message);
    await browser.close();
    const failed = results.filter((r) => !r.ok);
    await writeEvidence({ scope: "Admin acquisition continuation flow", headed, tool: "scripts/acquisition-flow-e2e-check.mjs", result: "failed", businessFlow: { subject: "offer -> accept -> acquisition -> pay", steps: results.map((r) => r.name) } });
    process.exitCode = 1;
    return;
  }

  try {
    await page.goto(`${ADMIN}/acquisition`, { waitUntil: "load", timeout: 30000 });
    const viewButton = page.getByRole("button", { name: "View" }).first();
    try { await viewButton.waitFor({ state: "visible", timeout: 15000 }); } catch {}
    if (!(await viewButton.count())) {
      rec("open-sell-request", false, "no View button (no sell requests?)");
    } else {
      await viewButton.click();
      await page.waitForTimeout(600);
      const dialog = page.getByRole("dialog");
      const opened = await dialog.count() > 0;
      rec("open-sell-request", opened);

      if (opened) {
        const body = await dialog.innerText().catch(() => "");
        rec("offers-section", body.includes("Offer history"), body.includes("Offer history") ? "OFFERS history section present" : "OFFERS section missing");
        const statusPill = dialog.locator(".detailList span.pill").first();
        async function sellStatus() { return statusPill.textContent().catch(() => ""); }
        async function clickTransition(label) {
          const btn = dialog.getByRole("button", { name: "→ " + label });
          if (await btn.count()) { await btn.click(); await page.waitForTimeout(500); }
        }
        await clickTransition("Reviewing");
        await page.waitForTimeout(500);

        const createOfferForm = dialog.locator("form").first();
        if (!(await createOfferForm.count())) {
          rec("create-offer", false, "no Create offer form");
        } else {
          await createOfferForm.locator("input[name=amount]").fill("25000");
          const respP = page.waitForResponse((r) => r.url().endsWith("/api/v1/admin/offers") && r.request().method() === "POST", { timeout: 30000 });
          await createOfferForm.getByRole("button", { name: "Create offer" }).click();
          const resp = await respP;
          rec("create-offer", resp.status() === 201, `http ${resp.status()}`);
          await page.waitForTimeout(700);
          rec("status-offered", (await sellStatus()) === "Offer sent", `sell status=${await sellStatus()}`);
          await page.waitForTimeout(600);
          const offersText = await dialog.locator("table").first().innerText().catch(() => "");
          rec("offer-listed-active", offersText.includes("25,000") && offersText.includes("ACTIVE"), offersText.includes("25,000") ? "offer amount listed" : "offer row missing");

          const sellerAgreed = dialog.getByRole("button", { name: "Seller agreed" }).first();
          if (!(await sellerAgreed.count())) {
            rec("seller-agreed", false, "no Seller agreed button");
          } else {
            await sellerAgreed.click();
            await page.waitForTimeout(700);
            const afterAccept = await dialog.innerText().catch(() => "");
            rec("offer-accepted", afterAccept.includes("ACCEPTED"), "offer moved to ACCEPTED");
            rec("status-accepted", (await sellStatus()) === "Accepted", `sell status=${await sellStatus()}`);
          }

          // Inspection now follows acceptance: ACCEPTED → INSPECTION_REQUIRED → INSPECTING.
          await clickTransition("Inspection required");
          rec("status-inspection-required", (await sellStatus()) === "Inspection required", `sell status=${await sellStatus()}`);
          await clickTransition("Inspecting");
          rec("status-inspecting", (await sellStatus()) === "Inspecting", `sell status=${await sellStatus()}`);
          await page.waitForTimeout(500);

          const createAcq = dialog.getByRole("button", { name: "Create acquisition" }).first();
          try { await createAcq.waitFor({ state: "visible", timeout: 15000 }); } catch {}
          if (!(await createAcq.count())) {
            rec("create-acquisition", false, "no Create acquisition button");
          } else {
            const respP2 = page.waitForResponse((r) => r.url().endsWith("/api/v1/admin/acquisitions") && r.request().method() === "POST", { timeout: 30000 });
            await createAcq.click();
            const resp2 = await respP2;
            rec("create-acquisition", resp2.status() === 201, `http ${resp2.status()}`);
            await page.waitForTimeout(700);
            const acqText = await dialog.innerText().catch(() => "");
            rec("acquisition-pending", acqText.includes("PENDING"), "acquisition PENDING shown");
            rec("status-acq-pending", (await sellStatus()) === "Acquisition pending", `sell status=${await sellStatus()}`);
          }

          const markPaid = dialog.getByRole("button", { name: "Mark paid" }).first();
          try { await markPaid.waitFor({ state: "visible", timeout: 15000 }); } catch {}
          if (!(await markPaid.count())) {
            rec("mark-paid", false, "no Mark paid button");
          } else {
            const respP3 = page.waitForResponse((r) => r.url().includes("/pay") && r.request().method() === "POST", { timeout: 30000 });
            await markPaid.click();
            const resp3 = await respP3;
            rec("mark-paid", resp3.status() === 201, `http ${resp3.status()}`);
            await page.waitForTimeout(700);
            const paidText = await dialog.innerText().catch(() => "");
            rec("acquisition-paid", paidText.includes("PAID"), "acquisition PAID shown");
            rec("status-paid", (await sellStatus()) === "Paid", `sell status=${await sellStatus()}`);
            const serialInput = dialog.locator("input[name=serial]");
            try { await serialInput.waitFor({ state: "visible", timeout: 15000 }); } catch {}
            if (!(await serialInput.count())) {
              rec("register-item", false, "no serial input");
            } else {
              await serialInput.fill(`SN-E2E-${Date.now().toString().slice(-6)}`);
              const respP4 = page.waitForResponse((r) => r.url().endsWith("/api/v1/admin/inventory") && r.request().method() === "POST", { timeout: 30000 });
              await dialog.getByRole("button", { name: "Register inventory item" }).click();
              const resp4 = await respP4;
              rec("register-item", resp4.status() === 201, `http ${resp4.status()}`);
              await page.waitForTimeout(700);
              const regText = await dialog.innerText().catch(() => "");
              rec("item-registered-shown", regText.includes("Item registered"), "registered item PCX ID shown");
            }
          }
        }
      }
    }
  } catch (e) {
    rec("flow", false, e.message);
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);

  if (process.argv.includes("--evidence")) {
    await writeEvidence({
      scope: "Admin acquisition continuation + sell-request status auto-advance + inventory intake (offer to accept to acquisition to pay to register item)",
      headed,
      tool: "scripts/acquisition-flow-e2e-check.mjs",
      result: failed.length === 0 ? "passed" : "failed",
      businessFlow: {
        subject: "Admin offer to accept to acquisition to pay to inventory intake with status auto-advance",
        steps: results.map((r) => r.name)
      }
    });
  }

  process.stdout.write(`\nacquisition-flow-e2e: ${results.length - failed.length}/${results.length} passed\n`);
  if (failed.length) {
    for (const r of failed) process.stderr.write(`  ✖ ${r.name}: ${r.detail}\n`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  process.stderr.write(`acquisition-flow-e2e failed: ${e?.message ?? String(e)}\n`);
  process.exitCode = 1;
});
