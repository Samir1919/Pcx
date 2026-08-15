import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const sessionPolicy = Object.freeze({
  credentialBytes: 32,
  accessLifetimeMs: 15 * 60 * 1000,
  refreshLifetimeMs: 30 * 24 * 60 * 60 * 1000
});

export function generateOpaqueCredential(random = randomBytes) {
  const bytes = random(sessionPolicy.credentialBytes);
  if (!Buffer.isBuffer(bytes) || bytes.length !== sessionPolicy.credentialBytes) {
    throw new TypeError("credential entropy source must return exactly 32 bytes");
  }
  return bytes.toString("base64url");
}

export function hashOpaqueCredential(credential) {
  if (typeof credential !== "string" || credential.length === 0) throw new TypeError("credential is required");
  return createHash("sha256").update(credential, "utf8").digest();
}

export function credentialHashMatches(expectedHash, credential) {
  if (!Buffer.isBuffer(expectedHash) || expectedHash.length !== 32 || typeof credential !== "string") return false;
  const candidate = hashOpaqueCredential(credential);
  return timingSafeEqual(expectedHash, candidate);
}

export function sessionExpiries(now = new Date()) {
  const start = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(start.getTime())) throw new TypeError("now must be a valid timestamp");
  return Object.freeze({
    accessExpiresAt: new Date(start.getTime() + sessionPolicy.accessLifetimeMs).toISOString(),
    refreshExpiresAt: new Date(start.getTime() + sessionPolicy.refreshLifetimeMs).toISOString()
  });
}
