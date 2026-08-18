/**
 * Development-only contact verification adapter.
 *
 * Mirrors the dev MFA adapter: it accepts a deterministic one-time code
 * (`PCX_DEV_VERIFY_CODE`, default `123456`) so a newly registered customer can
 * complete contact verification locally without a real mail/sms provider.
 *
 * This adapter is injected only in development. Production never wires it, so
 * contact verification keeps the verified-first flow (an issued, delivered
 * token) until a real mail/phone delivery provider is approved and configured.
 */
export function createDevContactVerifier({ code = process.env.PCX_DEV_VERIFY_CODE ?? "123456" } = {}) {
  if (typeof code !== "string" || code.length === 0) throw new TypeError("dev verification code is required");
  return Object.freeze({
    verify({ credential }) {
      return { verified: typeof credential === "string" && credential === code };
    }
  });
}
