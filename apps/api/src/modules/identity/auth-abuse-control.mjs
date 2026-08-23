const defaultLimits = Object.freeze({ register: 5, login: 10, refresh: 30, logout: 60, verify_contact_request: 5, password_reset_request: 5, verify_contact: 10, password_reset: 10, mfa_verify: 10, password_change: 10 });

// Per-contact limits are intentionally tighter than per-IP limits: the IP
// dimension protects against distributed/source flooding while the contact
// dimension stops a single email/phone from being brute-forced or spammed even
// from many source addresses. Keys are action names shared with defaultLimits.
const defaultContactLimits = Object.freeze({ register: 3, verify_contact_request: 3, password_reset_request: 3, verify_contact: 10, password_reset: 10, mfa_verify: 10 });

export function createInMemoryAuthAbuseControl({ clock = () => Date.now(), windowMs = 15 * 60 * 1000, limits = defaultLimits, contactLimits = defaultContactLimits, maximumKeys = 10_000 } = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new TypeError("windowMs must be a positive integer");
  if (!Number.isSafeInteger(maximumKeys) || maximumKeys < 1) throw new TypeError("maximumKeys must be a positive integer");
  const entries = new Map();

  function prune(now) {
    for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
  }

  function evaluate(key, limit, ipHash, now) {
    if (!Buffer.isBuffer(ipHash) || ipHash.length !== 32) return { allowed: false, reason: "invalid_control_key" };
    if (!Number.isFinite(now)) return { allowed: false, reason: "invalid_clock" };
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      if (entries.size >= maximumKeys) prune(now);
      if (entries.size >= maximumKeys && !entries.has(key)) return { allowed: false, reason: "limiter_capacity" };
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;
    return Object.freeze({ allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt });
  }

  return Object.freeze({
    // `contact` is an optional normalized contact (email or E.164 phone). When
    // present, BOTH the IP and the contact keys must be within their limits; the
    // stricter contact limit wins and rejects spam/brute-force per contact.
    async check({ action, ipHash, contact = null }) {
      const limit = limits[action];
      if (!Number.isSafeInteger(limit) || limit < 1) return { allowed: false, reason: "invalid_control_key" };
      if (!Buffer.isBuffer(ipHash) || ipHash.length !== 32) return { allowed: false, reason: "invalid_control_key" };
      const now = Number(clock());

      const contactLimit = contactLimits[action];
      const ipResult = evaluate(`${action}:ip:${ipHash.toString("hex")}`, limit, ipHash, now);
      if (!ipResult.allowed) return ipResult;

      if (typeof contact === "string" && contact.trim() !== "") {
        const normalized = contact.trim().toLowerCase();
        const key = `${action}:contact:${normalized}`;
        const contactResult = evaluate(key, Number.isSafeInteger(contactLimit) && contactLimit > 0 ? contactLimit : limit, ipHash, now);
        return Object.freeze({ ...contactResult, ipAllowed: ipResult.allowed, ipRemaining: ipResult.remaining, ipResetAt: ipResult.resetAt });
      }

      return ipResult;
    }
  });
}
