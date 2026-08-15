import { createInMemoryAuthAbuseControl } from "./auth-abuse-control.mjs";
import { createAuthService } from "./auth-service.mjs";
import { createPostgresAuthAudit } from "./postgres-auth-audit.mjs";
import { createPostgresIdentityRepository } from "./postgres-identity-repository.mjs";
import { createPostgresIdentityActionRepository } from "./postgres-identity-action-repository.mjs";
import { createIdentityActionService } from "./identity-action-service.mjs";
import { createPostgresAddressRepository } from "./postgres-address-repository.mjs";
import { createAddressService } from "./address-service.mjs";
import { createPostgresCatalogRepository } from "../catalog/postgres-catalog-repository.mjs";
import { createCatalogService } from "../catalog/catalog-service.mjs";
import { createPostgresCatalogCommandRepository } from "../catalog/postgres-catalog-command-repository.mjs";
import { createCatalogCommandService } from "../catalog/catalog-command-service.mjs";
import { createPostgresCatalogSpecCommandRepository } from "../catalog/postgres-catalog-spec-command-repository.mjs";
import { createCatalogSpecCommandService } from "../catalog/catalog-spec-command-service.mjs";

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

export function createAuthRuntime({ pool, allowedOrigins, abuseControl, audit, delivery, mfa } = {}) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");
  if (!delivery || typeof delivery.send !== "function") throw new TypeError("identity action delivery.send is required");
  const origins = parseAllowedOrigins(allowedOrigins instanceof Set ? [...allowedOrigins].join(",") : allowedOrigins);
  const repository = createPostgresIdentityRepository({ pool });
  const control = abuseControl ?? createInMemoryAuthAbuseControl();
  const auditSink = audit ?? createPostgresAuthAudit({ pool });
  const authService = createAuthService({
    repository,
    abuseControl: control,
    audit: auditSink,
    mfa
  });
  const identityActionService = createIdentityActionService({
    identityRepository: repository,
    actionRepository: createPostgresIdentityActionRepository({ pool }),
    delivery,
    abuseControl: control,
    audit: auditSink
  });
  const addressService = createAddressService({ authService, repository: createPostgresAddressRepository({ pool }) });
  const catalogService = createCatalogService({ repository: createPostgresCatalogRepository({ pool }) });
  const catalogCommandService = createCatalogCommandService({ authService, repository: createPostgresCatalogCommandRepository({ pool }) });
  const catalogSpecCommandService = createCatalogSpecCommandService({ authService, repository: createPostgresCatalogSpecCommandRepository({ pool }) });
  return Object.freeze({ authService, identityActionService, addressService, catalogService, catalogCommandService, catalogSpecCommandService, allowedOrigins: origins });
}
