import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { PaymentProviderConfigError } from "../src/modules/payment/payment-provider-config-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async listConfigs() { return [{ id: "cfg-1", provider: "bkash", mode: "SANDBOX", active: false, credentials: { appKey: "••••••••" } }]; },
    async saveConfig() { return { id: "cfg-1", provider: "bkash", mode: "SANDBOX", active: false, credentials: { appKey: "••••••••" } }; },
    async setActiveMode() { return [{ id: "cfg-1", provider: "bkash", mode: "SANDBOX", active: true, credentials: { appKey: "••••••••" } }]; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, paymentProviderConfigService = service(), allowedOrigins = new Set([origin]), requestId = "req-pay" } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": requestId, ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ paymentProviderConfigService, allowedOrigins })(request, response);
  return result;
}

test("payment provider config list is a same-origin read and requires no Origin/CSRF", async () => {
  // Same-origin browser GET sends neither an Origin nor a CSRF header.
  const response = await invoke("/api/v1/admin/payment-providers/bkash/config", { headers: { origin: undefined, "x-request-id": "req-pay" } });
  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].credentials.appKey, "••••••••");
});

test("payment provider config mutations still require Origin + CSRF", async () => {
  const missingCsrf = await invoke("/api/v1/admin/payment-providers/bkash/config", {
    method: "PUT",
    body: { mode: "SANDBOX", credentials: { appKey: "k" } },
    headers: { "x-request-id": "req-pay" }
  });
  assert.equal(missingCsrf.status, 403);

  const badOrigin = await invoke("/api/v1/admin/payment-providers/bkash/config", {
    method: "PUT",
    body: { mode: "SANDBOX", credentials: { appKey: "k" } },
    headers: { origin: "https://evil.example", cookie: "pcx_csrf=token", "x-csrf-token": "token", "x-request-id": "req-pay" }
  });
  assert.equal(badOrigin.status, 403);
  assert.equal(badOrigin.body.error.code, "ORIGIN_DENIED");

  const activate = await invoke("/api/v1/admin/payment-providers/bkash/activate", {
    method: "POST",
    body: { mode: "SANDBOX" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token", "x-request-id": "req-pay" }
  });
  assert.equal(activate.status, 200);
});

test("payment provider route rejects unknown methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/admin/payment-providers/bkash/config", { method: "DELETE" })).status, 405);
  assert.equal((await invoke("/api/v1/admin/payment-providers/bkash/config", { paymentProviderConfigService: null })).status, 503);
});

test("payment provider list surfaces forbidden as 403", async () => {
  const response = await invoke("/api/v1/admin/payment-providers/bkash/config", {
    headers: { origin: undefined, "x-request-id": "req-pay" },
    paymentProviderConfigService: service({ async listConfigs() { throw new PaymentProviderConfigError("forbidden"); } })
  });
  assert.equal(response.status, 403);
});
