// Credentials cipher: AES-256-GCM encryption for provider credentials at rest.
//
// The encryption key is supplied via the PAYMENT_CREDENTIALS_KEY environment
// variable (a 32-byte key, hex-encoded). A clearly-marked dev-only fallback is
// used when the variable is absent so local development and tests remain
// runnable; production must set a real key. The ciphertext is stored as
// `iv:authTag:ciphertext` (all base64url) so no separate columns are needed.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Dev-only fallback. Never use in production; the security scan and release
// preflight require a real PAYMENT_CREDENTIALS_KEY outside local development.
const DEV_ONLY_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

function keyFromEnv(value) {
  const raw = value ?? DEV_ONLY_KEY;
  const normalized = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new TypeError("PAYMENT_CREDENTIALS_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(normalized, "hex");
}

export function createCredentialsCipher({ key = process.env.PAYMENT_CREDENTIALS_KEY, env = process.env.NODE_ENV } = {}) {
  // Fail closed at startup in production: never silently encrypt provider
  // credentials under the dev-only zero key. Production must supply a real
  // 32-byte hex key for PAYMENT_CREDENTIALS_KEY.
  if (env === "production") {
    const raw = key == null || String(key).trim() === "" ? DEV_ONLY_KEY : String(key).trim();
    if (raw === DEV_ONLY_KEY) {
      throw new TypeError("PAYMENT_CREDENTIALS_KEY must be set to a real 32-byte hex key in production");
    }
  }
  const secret = keyFromEnv(key);
  return Object.freeze({
    encrypt(plaintext) {
      if (typeof plaintext !== "string") throw new TypeError("plaintext must be a string");
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", secret, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return [iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(":");
    },
    decrypt(payload) {
      if (typeof payload !== "string") throw new TypeError("payload must be a string");
      const parts = payload.split(":");
      if (parts.length !== 3) throw new TypeError("encrypted payload is malformed");
      const [iv, authTag, data] = parts;
      const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(authTag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    }
  });
}
