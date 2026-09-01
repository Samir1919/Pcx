import assert from "node:assert/strict";
import test from "node:test";
import { createBkashHttpAdapter, BKASH_LIVE_BASE_URL, BKASH_SANDBOX_BASE_URL } from "../src/modules/payment/bkash-http-adapter.mjs";

const credentials = { appKey: "ak", appSecret: "as", username: "u", password: "p" };
const jsonResponse = (payload, { ok = true, status = 200 } = {}) => ({ ok, status, text: async () => JSON.stringify(payload) });

function adapterWith(responses) {
  return createBkashHttpAdapter({
    credentials,
    fetchImpl: async (url, options) => {
      const key = Object.keys(responses).find((k) => url.endsWith(k));
      return typeof responses[key] === "function" ? responses[key](url, options) : responses[key];
    }
  });
}

test("adapter rejects a live base URL and requires credentials", () => {
  assert.throws(() => createBkashHttpAdapter({ baseUrl: BKASH_LIVE_BASE_URL, credentials }), /sandbox host/);
  assert.throws(() => createBkashHttpAdapter({ baseUrl: "http://tokenized.sandbox.bka.sh/x", credentials }), /https/);
  assert.throws(() => createBkashHttpAdapter({ credentials: {} }), /appKey/);
  assert.doesNotThrow(() => createBkashHttpAdapter({ baseUrl: BKASH_SANDBOX_BASE_URL, credentials }));
});

test("grantToken caches the id_token and sends username/password headers", async () => {
  let grantCalls = 0;
  const adapter = createBkashHttpAdapter({
    credentials,
    fetchImpl: async (url, options) => {
      if (url.endsWith("/token/grant")) {
        grantCalls += 1;
        assert.equal(options.headers.username, "u");
        assert.equal(options.headers.password, "p");
        assert.deepEqual(JSON.parse(options.body), { app_key: "ak", app_secret: "as" });
        return jsonResponse({ id_token: "tok-1", expires_in: 3600 });
      }
      if (url.endsWith("/create")) return jsonResponse({ statusCode: "0000", paymentID: "TR0011abc", transactionStatus: "Initiated" });
    }
  });
  await adapter.createPayment({ amount: 100, merchantInvoiceNumber: "inv-1", callbackURL: "https://cb" });
  await adapter.createPayment({ amount: 100, merchantInvoiceNumber: "inv-2", callbackURL: "https://cb" });
  assert.equal(grantCalls, 1, "token must be granted once and cached");
});

test("createPayment posts mode 0011 with auth headers and maps the payload", async () => {
  let createBody;
  let createHeaders;
  const adapter = adapterWith({
    "/tokenized/checkout/token/grant": jsonResponse({ id_token: "tok", expires_in: 3600 }),
    "/tokenized/checkout/create": (url, options) => {
      createBody = JSON.parse(options.body);
      createHeaders = options.headers;
      return jsonResponse({ statusCode: "0000", paymentID: "TR0011abc", bkashURL: "https://sandbox.payment.bkash.com", transactionStatus: "Initiated" });
    }
  });
  const created = await adapter.createPayment({ amount: 250, merchantInvoiceNumber: "inv-9", payerReference: "0171", callbackURL: "https://cb" });
  assert.equal(createBody.mode, "0011");
  assert.equal(createBody.amount, "250");
  assert.equal(createBody.merchantInvoiceNumber, "inv-9");
  assert.equal(createHeaders["x-app-key"], "ak");
  assert.ok(createHeaders.authorization);
  assert.equal(created.paymentID, "TR0011abc");
});

test("executePayment posts paymentID and returns trxID", async () => {
  let executeBody;
  const adapter = adapterWith({
    "/tokenized/checkout/token/grant": jsonResponse({ id_token: "tok", expires_in: 3600 }),
    "/tokenized/checkout/execute": (url, options) => {
      executeBody = JSON.parse(options.body);
      return jsonResponse({ paymentID: "TR0011abc", trxID: "6H6201QDIY", transactionStatus: "Completed" });
    }
  });
  const executed = await adapter.executePayment("TR0011abc");
  assert.deepEqual(executeBody, { paymentID: "TR0011abc" });
  assert.equal(executed.trxID, "6H6201QDIY");
});

test("refund posts paymentId/trxId/refundAmount and returns refundTrxId", async () => {
  let refundBody;
  const adapter = adapterWith({
    "/tokenized/checkout/token/grant": jsonResponse({ id_token: "tok", expires_in: 3600 }),
    "/refund/payment/transaction": (url, options) => {
      refundBody = JSON.parse(options.body);
      return jsonResponse({ refundTrxId: "BFD90JRMH9", refundTransactionStatus: "Completed" });
    }
  });
  const outcome = await adapter.refund({ paymentId: "TR0011abc", trxId: "BFD90JRLST", amount: 1, sku: "s", reason: "r" });
  assert.deepEqual(refundBody, { paymentId: "TR0011abc", trxId: "BFD90JRLST", refundAmount: "1", sku: "s", reason: "r" });
  assert.equal(outcome.refundTrxID, "BFD90JRMH9");
});

test("adapter throws on a non-ok bKash response", async () => {
  const adapter = adapterWith({
    "/tokenized/checkout/token/grant": jsonResponse({ id_token: "tok", expires_in: 3600 }),
    "/tokenized/checkout/create": jsonResponse({ errorMessage: "Invalid app token" }, { ok: false, status: 401 })
  });
  await assert.rejects(
    adapter.createPayment({ amount: 100, merchantInvoiceNumber: "inv", callbackURL: "https://cb" }),
    /Invalid app token/
  );
});
