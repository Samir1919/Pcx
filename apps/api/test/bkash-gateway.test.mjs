import assert from "node:assert/strict";
import test from "node:test";
import { createBkashGateway } from "@pcx/domain";

test("bkash gateway derives a deterministic provider transaction id from mode and reference", async () => {
  const gateway = createBkashGateway({ mode: "SANDBOX", credentials: { appKey: "k" } });
  const first = await gateway.charge({ amount: 100, currency: "BDT", reference: "pay-1" });
  const second = await gateway.charge({ amount: 100, currency: "BDT", reference: "pay-1" });
  assert.equal(first.providerTransactionId, "bkash-sandbox-pay-1");
  assert.equal(first.status, "CONFIRMED");
  assert.equal(first.mode, "SANDBOX");
  assert.equal(second.providerTransactionId, first.providerTransactionId);
});

test("bkash gateway is idempotent by reference", async () => {
  const gateway = createBkashGateway({ mode: "REAL", credentials: { appKey: "k" } });
  const first = await gateway.charge({ amount: 50, currency: "BDT", reference: "pay-2" });
  const second = await gateway.charge({ amount: 50, currency: "BDT", reference: "pay-2" });
  assert.equal(first.providerTransactionId, "bkash-real-pay-2");
  assert.equal(second.providerTransactionId, first.providerTransactionId);
});

test("bkash gateway dedupes concurrent charges for the same reference", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const gateway = createBkashGateway({
    mode: "REAL",
    credentials: { appKey: "k" },
    charge: async ({ reference, mode }) => {
      calls += 1;
      await gate;
      return { providerTransactionId: `custom-${mode}-${reference}`, status: "CONFIRMED" };
    }
  });
  const first = gateway.charge({ amount: 50, currency: "BDT", reference: "race-2" });
  const second = gateway.charge({ amount: 50, currency: "BDT", reference: "race-2" });
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1, "concurrent same-reference charges must share one in-flight charge");
  assert.equal(a.providerTransactionId, "custom-REAL-race-2");
  assert.equal(b.providerTransactionId, "custom-REAL-race-2");
});

test("bkash gateway validates mode, amount, currency and reference", async () => {
  assert.throws(() => createBkashGateway({ mode: "PROD", credentials: { appKey: "k" } }), /mode is invalid/);
  assert.throws(() => createBkashGateway({ mode: "SANDBOX", credentials: "nope" }), /credentials must be an object/);
  const gateway = createBkashGateway({ mode: "SANDBOX", credentials: { appKey: "k" } });
  await assert.rejects(gateway.charge({ amount: -1, currency: "BDT", reference: "r" }), /amount must be a positive/);
  await assert.rejects(gateway.charge({ amount: 10, currency: "XYZ", reference: "r" }), /currency is not supported/);

  await assert.rejects(gateway.charge({ amount: 10, currency: "BDT", reference: "" }), /reference must be a non-empty/);
});

test("bkash gateway supports an injected charge implementation", async () => {
  const gateway = createBkashGateway({ mode: "SANDBOX", credentials: { appKey: "k" }, charge: async ({ reference, mode }) => ({ providerTransactionId: `custom-${mode}-${reference}`, status: "INITIATED" }) });
  const result = await gateway.charge({ amount: 10, currency: "BDT", reference: "pay-3" });
  assert.equal(result.providerTransactionId, "custom-SANDBOX-pay-3");
  assert.equal(result.status, "INITIATED");
});
