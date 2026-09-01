import assert from "node:assert/strict";
import test from "node:test";
import { createBkashHttpGateway } from "../src/modules/payment/bkash-http-gateway.mjs";

function gatewayWith(adapter) {
  return createBkashHttpGateway({ adapter, callbackURL: "https://cb.example" });
}

test("charge maps createPayment to the provider-neutral INITIATED contract", async () => {
  const calls = [];
  const gateway = gatewayWith({
    async createPayment(args) { calls.push(args); return { paymentID: "TR0011abc", bkashURL: "https://bkash", transactionStatus: "Initiated" }; },
    async executePayment() { return {}; },
    async refund() { return {}; }
  });
  const result = await gateway.charge({ amount: 250, currency: "BDT", reference: "inv-9" });
  assert.equal(result.providerTransactionId, "TR0011abc");
  assert.equal(result.status, "INITIATED");
  assert.equal(result.bkashURL, "https://bkash");
  assert.equal(calls[0].merchantInvoiceNumber, "inv-9");
  assert.equal(calls[0].callbackURL, "https://cb.example");
});

test("execute maps a Completed bKash status to CONFIRMED with the trxID", async () => {
  const gateway = gatewayWith({
    async executePayment() { return { paymentID: "TR", trxID: "6H6201QDIY", transactionStatus: "Completed" }; },
    async createPayment() { return {}; },
    async refund() { return {}; }
  });
  const result = await gateway.execute({ paymentId: "TR" });
  assert.equal(result.providerTransactionId, "6H6201QDIY");
  assert.equal(result.status, "CONFIRMED");
});

test("refund maps a Completed bKash refund to CONFIRMED with the refundTrxId", async () => {
  let refundArgs;
  const gateway = gatewayWith({
    async refund(args) { refundArgs = args; return { refundTrxID: "BFD90JRMH9", transactionStatus: "Completed" }; },
    async createPayment() { return {}; },
    async executePayment() { return {}; }
  });
  const result = await gateway.refund({ amount: 1, currency: "BDT", reference: "r1", paymentId: "TR", trxId: "BFD90JRLST" });
  assert.equal(result.providerTransactionId, "BFD90JRMH9");
  assert.equal(result.status, "CONFIRMED");
  assert.equal(refundArgs.paymentId, "TR");
  assert.equal(refundArgs.trxId, "BFD90JRLST");
});

test("gateway validates the required adapter methods", () => {
  assert.throws(() => createBkashHttpGateway({ adapter: {} }), /createPayment/);
  assert.throws(() => createBkashHttpGateway({ adapter: { async createPayment() {}, async executePayment() {} } }), /refund/);
});
