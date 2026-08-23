import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationProviderConfigService } from "../src/modules/notification/notification-provider-config-service.mjs";

function fakeCipher() {
  const store = new Map();
  let seq = 0;
  return {
    store,
    encrypt(plaintext) { const token = `enc:${++seq}`; store.set(token, plaintext); return token; },
    decrypt(payload) { return store.get(payload); }
  };
}

function auth(allowed = true) {
  return {
    async authenticateAccess() {
      return { userId: "admin-1", roles: allowed ? ["ADMIN"] : ["CUSTOMER"], status: "ACTIVE" };
    }
  };
}

function repository() {
  const rows = [];
  return {
    rows,
    async upsert(record) {
      const found = rows.find((r) => r.provider === record.provider && r.mode === record.mode);
      if (found) Object.assign(found, record, { updatedAt: record.createdAt });
      else rows.push({ ...record, updatedAt: record.createdAt });
      return rows.find((r) => r.provider === record.provider && r.mode === record.mode);
    },
    async findByProviderAndMode(provider, mode) {
      return rows.find((r) => r.provider === provider && r.mode === mode) ?? null;
    },
    async listByProvider(provider) { return rows.filter((r) => r.provider === provider); },
    async setActive(provider, mode, now) {
      for (const r of rows) if (r.provider === provider) r.active = r.mode === mode;
      return rows.filter((r) => r.provider === provider);
    }
  };
}

test("saves and masks email/sms credentials, never returns plaintext", async () => {
  const repo = repository();
  const cipher = fakeCipher();
  const service = createNotificationProviderConfigService({ authService: auth(), repository: repo, cipher, id: () => "id-1" });

  const savedEmail = await service.saveConfig("cred", { provider: "EMAIL", mode: "SANDBOX", credentials: { apiKey: "re_secret_token_123", from: "PCX <no-reply@pcx.com.bd>" } });
  assert.equal(savedEmail.credentials.apiKey.includes("_secret_token"), false);
  assert.match(savedEmail.credentials.apiKey, /^••••/);

  const savedSms = await service.saveConfig("cred", { provider: "SMS", mode: "REAL", credentials: { token: "1234567890123456789" } });
  assert.equal(savedSms.credentials.token.includes("123456789012"), false);

  // Repository stores ciphertext only, never plaintext.
  const stored = await repo.findByProviderAndMode("EMAIL", "SANDBOX");
  assert.equal(JSON.stringify(stored).includes("re_secret_token"), false);

  // getActiveCredentials decrypts internally for dispatcher/delivery use.
  await service.setActiveMode("cred", { provider: "EMAIL", mode: "SANDBOX" });
  const active = await service.getActiveCredentials("EMAIL");
  assert.equal(active.credentials.apiKey, "re_secret_token_123");
});

test("partial save preserves omitted credential fields", async () => {
  const repo = repository();
  const service = createNotificationProviderConfigService({ authService: auth(), repository: repo, cipher: fakeCipher(), id: () => "id-1" });
  await service.saveConfig("cred", { provider: "EMAIL", mode: "SANDBOX", credentials: { apiKey: "re_abc", from: "a@b.com" } });
  const updated = await service.saveConfig("cred", { provider: "EMAIL", mode: "SANDBOX", credentials: { apiKey: "re_new" } });
  assert.equal(updated.credentials.from.endsWith(".com"), true);
  const active = await (async () => { await service.setActiveMode("cred", { provider: "EMAIL", mode: "SANDBOX" }); return service.getActiveCredentials("EMAIL"); })();
  assert.equal(active.credentials.from, "a@b.com");
  assert.equal(active.credentials.apiKey, "re_new");
});

test("rejects unknown credential fields and non-admin", async () => {
  const repo = repository();
  const service = createNotificationProviderConfigService({ authService: auth(), repository: repo, cipher: fakeCipher(), id: () => "id-1" });
  await assert.rejects(service.saveConfig("cred", { provider: "SMS", mode: "SANDBOX", credentials: { token: "x", extra: "y" } }), /invalid_input/);
  const deniedService = createNotificationProviderConfigService({ authService: auth(false), repository: repo, cipher: fakeCipher(), id: () => "id-1" });
  await assert.rejects(deniedService.saveConfig("cred", { provider: "SMS", mode: "SANDBOX", credentials: { token: "x" } }), /forbidden/);
});
