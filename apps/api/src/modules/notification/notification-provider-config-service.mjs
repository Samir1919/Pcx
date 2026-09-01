import { randomUUID } from "node:crypto";
import { hasPermission, Permission } from "@pcx/domain";
import { createCredentialsCipher } from "../payment/credentials-cipher.mjs";

export class NotificationProviderConfigError extends Error {
  constructor(code) { super(code); this.name = "NotificationProviderConfigError"; this.code = code; }
}

const providers = new Set(["EMAIL", "SMS"]);
const modes = new Set(["SANDBOX", "REAL"]);

// Each provider accepts a fixed key set. Unknown keys are rejected so a client
// cannot smuggle extra data into the stored record.
const credentialFields = Object.freeze({
  EMAIL: new Set(["apiKey", "from"]),
  SMS: new Set(["token"])
});

function exact(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new NotificationProviderConfigError("invalid_input");
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new NotificationProviderConfigError("invalid_input");
  return input;
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new NotificationProviderConfigError("invalid_input");
  return value.trim();
}

function normalizeCredentials(provider, input) {
  const allowed = credentialFields[provider];
  const fields = exact(input, allowed);
  const result = {};
  if (provider === "EMAIL") {
    if (fields.apiKey !== undefined) result.apiKey = assertNonEmptyString(fields.apiKey, "apiKey");
    if (fields.from !== undefined) result.from = assertNonEmptyString(fields.from, "from");
  } else {
    if (fields.token !== undefined) result.token = assertNonEmptyString(fields.token, "token");
  }
  if (Object.keys(result).length === 0) throw new NotificationProviderConfigError("invalid_input");
  return result;
}

// Masks the decrypted credentials for the admin UI. Shows a short suffix so an
// admin can distinguish configured accounts without exposing secrets.
function maskCredentials(provider, credentials) {
  const masked = {};
  for (const [key, value] of Object.entries(credentials ?? {})) {
    if (typeof value !== "string" || value.length === 0) { masked[key] = null; continue; }
    if (value.length <= 4) { masked[key] = "••••"; continue; }
    masked[key] = `••••${value.slice(-4)}`;
  }
  return masked;
}

export function createNotificationProviderConfigService({ authService, repository, cipher = createCredentialsCipher(), id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["upsert", "findByProviderAndMode", "listByProvider", "setActive", "remove"]) {
    if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
  }
  if (!cipher || typeof cipher.encrypt !== "function" || typeof cipher.decrypt !== "function") throw new TypeError("cipher.encrypt/decrypt is required");

  async function admin(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new NotificationProviderConfigError("forbidden");
    return identity;
  }

  function safeProvider(value) {
    const provider = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (!providers.has(provider)) throw new NotificationProviderConfigError("invalid_input");
    return provider;
  }

  function safeMode(value) {
    const mode = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (!modes.has(mode)) throw new NotificationProviderConfigError("invalid_input");
    return mode;
  }

  function publicConfig(record, credentials) {
    return Object.freeze({
      id: record.id,
      provider: record.provider,
      mode: record.mode,
      active: record.active,
      credentials: maskCredentials(record.provider, credentials),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  }

  return Object.freeze({
    async saveConfig(accessCredential, input) {
      await admin(accessCredential);
      const fields = exact(input, new Set(["provider", "mode", "credentials"]));
      const provider = safeProvider(fields.provider);
      const mode = safeMode(fields.mode);
      const incoming = normalizeCredentials(provider, fields.credentials);

      // Preserve credentials omitted from a partial save (a blank field means
      // "keep the current value"). Merge with any existing stored credentials
      // first so a partial update never wipes previously saved secrets.
      const existing = await repository.findByProviderAndMode(provider, mode);
      let previous = {};
      try {
        if (existing) previous = JSON.parse(cipher.decrypt(existing.encryptedCredentials));
      } catch {
        previous = {};
      }
      const credentials = normalizeCredentials(provider, { ...previous, ...incoming });
      const active = existing ? existing.active === true : false;

      const now = clock();
      const record = {
        id: id(),
        provider,
        mode,
        encryptedCredentials: cipher.encrypt(JSON.stringify(credentials)),
        active,
        createdAt: existing?.createdAt ?? now.toISOString()
      };
      const stored = await repository.upsert(record);
      return publicConfig(stored, credentials);
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
      const records = await repository.setActive(provider, mode, clock().toISOString());
      return Object.freeze(records.map((record) => {
        let credentials = {};
        try { credentials = JSON.parse(cipher.decrypt(record.encryptedCredentials)); } catch { credentials = {}; }
        return publicConfig(record, credentials);
      }));
    },

    // Hard-delete a stored provider+mode config. Removing an active config means
    // the provider has no active credentials afterward (delivery fails closed).
    async removeConfig(accessCredential, input) {
      await admin(accessCredential);
      const fields = exact(input, new Set(["provider", "mode"]));
      const provider = safeProvider(fields.provider);
      const mode = safeMode(fields.mode);
      const deleted = await repository.remove(provider, mode);
      if (!deleted) throw new NotificationProviderConfigError("not_found");
      return Object.freeze({ provider, mode, removed: true });
    },

    // Internal: returns the decrypted credentials for the active mode of a
    // provider, or null when none is configured/active. Used by dispatchers and
    // the contact delivery service to send via the configured provider. Never
    // exposed over HTTP.
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
