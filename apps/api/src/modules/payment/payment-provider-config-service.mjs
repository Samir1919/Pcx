import { randomUUID } from "node:crypto";
import { createPaymentProviderConfig, hasPermission, maskCredentials, normalizeCredentials, PaymentProvider, PaymentProviderMode, Permission } from "../../../../../packages/domain/src/index.mjs";
import { createCredentialsCipher } from "./credentials-cipher.mjs";

export class PaymentProviderConfigError extends Error {
  constructor(code) { super(code); this.name = "PaymentProviderConfigError"; this.code = code; }
}

const modes = new Set(Object.values(PaymentProviderMode));
const providers = new Set(Object.values(PaymentProvider));

function exact(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PaymentProviderConfigError("invalid_input");
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new PaymentProviderConfigError("invalid_input");
  return input;
}

export function createPaymentProviderConfigService({ authService, repository, cipher = createCredentialsCipher(), id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["upsert", "findByProviderAndMode", "listByProvider", "setActive"]) {
    if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
  }
  if (!cipher || typeof cipher.encrypt !== "function" || typeof cipher.decrypt !== "function") throw new TypeError("cipher.encrypt/decrypt is required");

  async function admin(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new PaymentProviderConfigError("forbidden");
    return identity;
  }

  function safeProvider(value) {
    const provider = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!providers.has(provider)) throw new PaymentProviderConfigError("invalid_input");
    return provider;
  }

  function safeMode(value) {
    const mode = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (!modes.has(mode)) throw new PaymentProviderConfigError("invalid_input");
    return mode;
  }

  // Public (masked) projection: never exposes plaintext credentials.
  function publicConfig(record, credentials) {
    return Object.freeze({
      id: record.id,
      provider: record.provider,
      mode: record.mode,
      active: record.active,
      credentials: maskCredentials(credentials),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  }

  return Object.freeze({
    async saveConfig(accessCredential, input) {
      await admin(accessCredential);
      const fields = exact(input, new Set(["provider", "mode", "credentials", "active"]));
      const provider = safeProvider(fields.provider);
      const mode = safeMode(fields.mode);
      let incoming;
      try {
        incoming = normalizeCredentials(fields.credentials);
      } catch {
        throw new PaymentProviderConfigError("invalid_input");
      }
      // Preserve credentials omitted from a partial save (a blank field means
      // "keep the current value"). Merge the existing stored credentials first
      // so a partial update never wipes previously saved secrets.
      const existing = await repository.findByProviderAndMode(provider, mode);
      let previous = {};
      try {
        if (existing) previous = JSON.parse(cipher.decrypt(existing.encryptedCredentials));
      } catch {
        previous = {};
      }
      let credentials;
      try {
        credentials = normalizeCredentials({ ...previous, ...incoming });
      } catch {
        throw new PaymentProviderConfigError("invalid_input");
      }
      const now = clock();
      let record;
      try {
        record = createPaymentProviderConfig({
          id: id(),
          provider,
          mode,
          credentials,
          active: fields.active === true,
          createdAt: now
        });
      } catch {
        throw new PaymentProviderConfigError("invalid_input");
      }
      const encrypted = cipher.encrypt(JSON.stringify(record.credentials));
      const stored = await repository.upsert({ ...record, encryptedCredentials: encrypted });
      return publicConfig(stored, record.credentials);
    },

    async listConfigs(accessCredential, providerValue) {
      await admin(accessCredential);
      const provider = safeProvider(providerValue);
      const records = await repository.listByProvider(provider);
      return Object.freeze(records.map((record) => {
        let credentials = {};
        try { credentials = JSON.parse(cipher.decrypt(record.encryptedCredentials)); } catch { credentials = {}; }
        return publicConfig(record, credentials);
      }));
    },

    async setActiveMode(accessCredential, input) {
      await admin(accessCredential);
      const fields = exact(input, new Set(["provider", "mode"]));
      const provider = safeProvider(fields.provider);
      const mode = safeMode(fields.mode);
      const now = clock().toISOString();
      const records = await repository.setActive(provider, mode, now);
      return Object.freeze(records.map((record) => {
        let credentials = {};
        try { credentials = JSON.parse(cipher.decrypt(record.encryptedCredentials)); } catch { credentials = {}; }
        return publicConfig(record, credentials);
      }));
    },

    // Internal: returns the decrypted credentials for the active mode of a
    // provider, or null when none is configured/active. Used by the payment
    // service to build a real gateway. Never exposed over HTTP.
    async getActiveCredentials(providerValue) {
      const provider = safeProvider(providerValue);
      const records = await repository.listByProvider(provider);
      const active = records.find((record) => record.active === true);
      if (!active) return null;
      try {
        return Object.freeze({ mode: active.mode, credentials: JSON.parse(cipher.decrypt(active.encryptedCredentials)) });
      } catch {
        return null;
      }
    }
  });
}
