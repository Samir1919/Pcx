import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentProviderConfigService } from "../src/modules/payment/payment-provider-config-service.mjs";
import { createCredentialsCipher } from "../src/modules/payment/credentials-cipher.mjs";

const adminIdentity = { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] };
const customerIdentity = { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] };

function fixture(overrides = {}) {
  const calls = { upserts: [], lists: [], active: [], setActive: [] };
  const store = new Map();
  const repository = {
    async upsert(record) { calls.upserts.push(record); store.set(`${record.provider}:${record.mode}`, record); return record; },
    async findByProviderAndMode(provider, mode) { return store.get(`${provider}:${mode}`) ?? null; },
    async listByProvider(provider) { calls.lists.push(provider); return [...store.values()].filter((r) => r.provider === provider); },
    async setActive(provider, mode, now) {
      calls.setActive.push({ provider, mode, now });
      const records = [...store.values()].filter((r) => r.provider === provider);
      for (const record of records) record.active = record.mode === mode;
      return records;
    },
    ...overrides.repository
  };
  const service = createPaymentProviderConfigService({
    authService: { async authenticateAccess() { return adminIdentity; }, ...overrides.authService },
    repository,
    cipher: createCredentialsCipher({ key: "a".repeat(64) }),
    id: (() => { let n = 0; return () => `cfg-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
  });
  return { service, calls, store };
}

test("saveConfig requires SYSTEM_CONFIGURE permission", async () => {
  const { service } = fixture({ authService: { async authenticateAccess() { return customerIdentity; } } });
  await assert.rejects(service.saveConfig("access", { provider: "bkash", mode: "SANDBOX", credentials: { appKey: "k" } }), (error) => error.code === "forbidden");
});

test("saveConfig encrypts credentials and returns a masked projection", async () => {
  const { service, calls } = fixture();
  const result = await service.saveConfig("access", { provider: "bkash", mode: "SANDBOX", credentials: { appKey: "secret-key", merchantNumber: "01700000000" } });
  assert.equal(result.provider, "bkash");
  assert.equal(result.mode, "SANDBOX");
  assert.equal(result.active, false);
  assert.equal(result.credentials.appKey, "••••••••");
  assert.equal(result.credentials.merchantNumber, "01700000000");
  assert.equal(calls.upserts.length, 1);
  assert.notEqual(calls.upserts[0].encryptedCredentials, JSON.stringify({ appKey: "secret-key", merchantNumber: "01700000000" }));
  assert.ok(calls.upserts[0].encryptedCredentials.includes(":"));
});

test("saveConfig rejects unknown credential fields and invalid input", async () => {
  const { service } = fixture();
  await assert.rejects(service.saveConfig("access", { provider: "bkash", mode: "SANDBOX", credentials: { appKey: "k", evil: "x" } }), (error) => error.code === "invalid_input");
  await assert.rejects(service.saveConfig("access", { provider: "bkash", mode: "SANDBOX", credentials: {} }), (error) => error.code === "invalid_input");
  await assert.rejects(service.saveConfig("access", { provider: "unknown", mode: "SANDBOX", credentials: { appKey: "k" } }), (error) => error.code === "invalid_input");
  await assert.rejects(service.saveConfig("access", { provider: "bkash", mode: "PROD", credentials: { appKey: "k" } }), (error) => error.code === "invalid_input");
});

test("listConfigs returns masked credentials and never plaintext", async () => {
  const { service } = fixture();
  await service.saveConfig("access", { provider: "bkash", mode: "SANDBOX", credentials: { appKey: "sandbox-key", appSecret: "sandbox-secret" } });
  const list = await service.listConfigs("access", "bkash");
  assert.equal(list.length, 1);
  assert.equal(list[0].credentials.appKey, "••••••••");
  assert.equal(list[0].credentials.appSecret, "••••••••");
  assert.ok(!JSON.stringify(list).includes("sandbox-key"));
  assert.ok(!JSON.stringify(list).includes("sandbox-secret"));
});

test("setActiveMode activates one mode and deactivates the other", async () => {
  const { service } = fixture();
  await service.saveConfig("access", { provider: "bkash", mode: "SANDBOX", credentials: { appKey: "s" } });
  await service.saveConfig("access", { provider: "bkash", mode: "REAL", credentials: { appKey: "r" } });
  const activated = await service.setActiveMode("access", { provider: "bkash", mode: "REAL" });
  assert.equal(activated.find((c) => c.mode === "REAL").active, true);
  assert.equal(activated.find((c) => c.mode === "SANDBOX").active, false);
});

test("getActiveCredentials returns decrypted credentials for the active mode only", async () => {
  const { service } = fixture();
  await service.saveConfig("access", { provider: "bkash", mode: "SANDBOX", credentials: { appKey: "sandbox-key" } });
  await service.saveConfig("access", { provider: "bkash", mode: "REAL", credentials: { appKey: "real-key" } });
  assert.equal(await service.getActiveCredentials("bkash"), null);
  await service.setActiveMode("access", { provider: "bkash", mode: "REAL" });
  const active = await service.getActiveCredentials("bkash");
  assert.equal(active.mode, "REAL");
  assert.equal(active.credentials.appKey, "real-key");
});

test("getActiveCredentials returns null when nothing is configured", async () => {
  const { service } = fixture();
  assert.equal(await service.getActiveCredentials("bkash"), null);
});
