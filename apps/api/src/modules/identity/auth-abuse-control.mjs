const defaultLimits = Object.freeze({ register: 5, login: 10, refresh: 30, logout: 60, verify_contact_request: 5, password_reset_request: 5, verify_contact: 10, password_reset: 10, mfa_verify: 10 });

export function createInMemoryAuthAbuseControl({ clock = () => Date.now(), windowMs = 15 * 60 * 1000, limits = defaultLimits, maximumKeys = 10_000 } = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new TypeError("windowMs must be a positive integer");
  if (!Number.isSafeInteger(maximumKeys) || maximumKeys < 1) throw new TypeError("maximumKeys must be a positive integer");
  const entries = new Map();

  function prune(now) {
    for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
  }

  return Object.freeze({
    async check({ action, ipHash }) {
      const limit = limits[action];
      if (!Number.isSafeInteger(limit) || limit < 1 || !Buffer.isBuffer(ipHash) || ipHash.length !== 32) return { allowed: false, reason: "invalid_control_key" };
      const now = Number(clock());
      if (!Number.isFinite(now)) return { allowed: false, reason: "invalid_clock" };
      const key = `${action}:${ipHash.toString("hex")}`;
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
  });
}
