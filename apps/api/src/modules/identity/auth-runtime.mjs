import { createInMemoryAuthAbuseControl } from "./auth-abuse-control.mjs";
import { createAuthService } from "./auth-service.mjs";
import { createPostgresAuthAudit } from "./postgres-auth-audit.mjs";
import { createPostgresIdentityRepository } from "./postgres-identity-repository.mjs";

export function parseAllowedOrigins(value) {
  if (typeof value !== "string") throw new TypeError("allowed origins are required");
  const origins = new Set();
  for (const candidate of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    let url;
    try { url = new URL(candidate); } catch { throw new TypeError("allowed origin is invalid"); }
    if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.origin !== candidate) {
      throw new TypeError("allowed origin must be an exact HTTP(S) origin");
    }
    origins.add(url.origin);
  }
  if (origins.size === 0) throw new TypeError("at least one allowed origin is required");
  return origins;
}

export function createAuthRuntime({ pool, allowedOrigins, abuseControl, audit } = {}) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");
  const origins = parseAllowedOrigins(allowedOrigins instanceof Set ? [...allowedOrigins].join(",") : allowedOrigins);
  const repository = createPostgresIdentityRepository({ pool });
  const authService = createAuthService({
    repository,
    abuseControl: abuseControl ?? createInMemoryAuthAbuseControl(),
    audit: audit ?? createPostgresAuthAudit({ pool })
  });
  return Object.freeze({ authService, allowedOrigins: origins });
}
