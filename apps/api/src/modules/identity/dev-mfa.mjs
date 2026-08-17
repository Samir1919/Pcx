import { randomUUID } from "node:crypto";

/**
 * Development-only, provider-neutral MFA adapter.
 *
 * Provides a deterministic one-time code (`PCX_DEV_MFA_CODE`, default
 * `123456`) so a privileged local demo/admin account can complete the two-step
 * login flow without a real SMS/TOTP provider. Challenges are held in memory
 * only and expire after five minutes.
 *
 * This adapter is deliberately injected only for local development (see
 * `apps/api/src/index.mjs`). Production never wires it, so privileged login
 * continues to fail closed with `mfa_unavailable` until a real provider is
 * approved and configured — the existing safe behavior is unchanged.
 */
export function createDevMfa({ code = process.env.PCX_DEV_MFA_CODE ?? "123456" } = {}) {
  if (typeof code !== "string" || code.length === 0) throw new TypeError("dev MFA code is required");
  const challenges = new Map();
  const ttlMs = 5 * 60 * 1000;

  return Object.freeze({
    async beginChallenge({ userId }) {
      const id = randomUUID();
      challenges.set(id, { userId, expiresAt: Date.now() + ttlMs });
      return { id, expiresAt: new Date(challenges.get(id).expiresAt).toISOString() };
    },
    async verifyChallenge({ challengeId, credential }) {
      const entry = challenges.get(challengeId);
      if (!entry || Date.now() > entry.expiresAt || credential !== code) return { status: "not_verified" };
      challenges.delete(challengeId);
      return { status: "verified", userId: entry.userId };
    }
  });
}
