import { randomInt, randomUUID } from "node:crypto";

// Provider-based MFA adapter.
//
// Sends a one-time code to the user's verified contact (email or phone) through
// the synchronous ContactDeliveryService and verifies the returned code against
// an in-memory challenge. This is the production-safe MFA: it fails closed
// (throws) when the identity has no delivery contact or no active EMAIL/SMS
// provider is configured, so privileged login returns `mfa_unavailable` instead
// of silently bypassing the second factor.

export function createProviderMfa({ identityRepository, contactDeliveryService, ttlMs = 5 * 60 * 1000, clock = Date.now, id = randomUUID }) {
  if (!identityRepository || typeof identityRepository.findContactByUserId !== "function") throw new TypeError("identityRepository.findContactByUserId is required");
  if (!contactDeliveryService || typeof contactDeliveryService.send !== "function") throw new TypeError("contactDeliveryService.send is required");
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new TypeError("ttlMs must be positive");

  const challenges = new Map();

  return Object.freeze({
    async beginChallenge({ userId }) {
      if (typeof userId !== "string" || userId.length === 0) throw new TypeError("userId is required");
      const contact = await identityRepository.findContactByUserId(userId);
      const destination = contact?.email ?? contact?.phone;
      if (!destination) throw new Error("no contact channel for MFA");

      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const expiresAt = new Date(clock() + ttlMs);
      const challengeId = id();
      challenges.set(challengeId, { userId, code, expiresAt: expiresAt.getTime() });

      try {
        await contactDeliveryService.send({
          purpose: "MFA",
          contact: destination,
          credential: code,
          expiresAt: expiresAt.toISOString()
        });
      } catch {
        challenges.delete(challengeId);
        throw new Error("MFA delivery unavailable");
      }
      return { id: challengeId, expiresAt: expiresAt.toISOString() };
    },

    async verifyChallenge({ challengeId, credential }) {
      const entry = challenges.get(challengeId);
      if (!entry || clock() > entry.expiresAt || typeof credential !== "string" || credential !== entry.code) {
        return { status: "not_verified" };
      }
      challenges.delete(challengeId);
      return { status: "verified", userId: entry.userId };
    }
  });
}
