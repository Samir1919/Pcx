import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { OrderPaymentError } from "../src/modules/commerce/order-payment-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async createOrder() { return { id: "o1", orderNo: "ORD-000001", subtotal: 1500, totalAmount: 1500 }; },
    async confirmPayment() { return { id: "p1", status: "CONFIRMED" }; },
    async reconcileBkashPayment() { return { id: "p1", status: "CONFIRMED" }; },
    ...overrides
  };
}

async function invoke(path, { method = "POST", body, headers = {}, orderPaymentService = service(), allowedOrigins = new Set([origin]) } = {}) {
  const serialized = body == null ? "" : JSON.stringify(body);
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status) { result.status = status; return response; },
    end(value) { result.body = value ? JSON.parse(value) : undefined; return response; }
  };
  const request = {
    url: path,
    method,
    headers: { origin, "content-type": "application/json", "x-request-id": "req-op", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ orderPaymentService, allowedOrigins })(request, response);
  return result;
}

function csrf() { return { cookie: "pcx_csrf=token", "x-csrf-token": "token" }; }

test("order creation requires CSRF and returns 201", async () => {
  const noCsrf = await invoke("/api/v1/orders", { body: { items: [] } });
  assert.equal(noCsrf.status, 403);

  const response = await invoke("/api/v1/orders", { body: { items: [{ inventoryItemId: "i", productModelId: "m", pcxItemId: "p", productName: "n", unitPrice: 1 }] }, headers: csrf() });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.orderNo, "ORD-000001");
});

test("payment confirm requires providerTransactionId and maps invalid state", async () => {
  const ok = await invoke("/api/v1/payments/confirm", { body: { providerTransactionId: "txn-1" }, headers: csrf() });
  assert.equal(ok.status, 200);

  const bad = await invoke("/api/v1/payments/confirm", { body: {}, headers: csrf() });
  assert.equal(bad.status, 422);

  const invalidState = await invoke("/api/v1/payments/confirm", { body: { providerTransactionId: "x" }, headers: csrf(), orderPaymentService: service({ async confirmPayment() { throw new OrderPaymentError("invalid_state"); } }) });
  assert.equal(invalidState.status, 409);
});

test("bKash redirect callback reconciles via GET with paymentID and maps errors", async () => {
  const ok = await invoke("/api/v1/payments/bkash/callback?paymentID=pay-1", { method: "GET" });
  assert.equal(ok.status, 200);

  assert.equal((await invoke("/api/v1/payments/bkash/callback", { method: "GET" })).status, 400);
  assert.equal((await invoke("/api/v1/payments/bkash/callback?paymentID=x", { method: "POST" })).status, 405);

  const invalidState = await invoke("/api/v1/payments/bkash/callback?paymentID=x", { method: "GET", orderPaymentService: service({ async reconcileBkashPayment() { throw new OrderPaymentError("invalid_state"); } }) });
  assert.equal(invalidState.status, 409);
});

test("bKash IPN reconciles via POST with a JSON paymentID body", async () => {
  const ok = await invoke("/api/v1/payments/bkash/ipn", { method: "POST", body: { paymentID: "pay-1" } });
  assert.equal(ok.status, 200);

  assert.equal((await invoke("/api/v1/payments/bkash/ipn", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/payments/bkash/ipn", { method: "POST", body: {} })).status, 400);
});

test("order creation maps the double-sell guard to 409 ITEM_UNAVAILABLE", async () => {
  const response = await invoke("/api/v1/orders", {
    body: { items: [{ inventoryItemId: "i", productModelId: "m", pcxItemId: "p", productName: "n", unitPrice: 1 }] },
    headers: csrf(),
    orderPaymentService: service({ async createOrder() { throw new OrderPaymentError("item_unavailable"); } })
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, "ITEM_UNAVAILABLE");
});

test("order payment route rejects unknown methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/orders", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/orders", { body: {}, orderPaymentService: null })).status, 503);
});
