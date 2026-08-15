import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { OrderPaymentError } from "../src/modules/commerce/order-payment-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async createOrder() { return { id: "o1", orderNo: "ORD-000001", subtotal: 1500, totalAmount: 1500 }; },
    async confirmPayment() { return { id: "p1", status: "CONFIRMED" }; },
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

test("order payment route rejects unknown methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/orders", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/orders", { body: {}, orderPaymentService: null })).status, 503);
});
