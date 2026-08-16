// Payment provider configuration domain.
//
// A provider configuration binds a provider (e.g. "bkash") to an environment
// mode (SANDBOX / REAL) and holds the credentials needed to talk to that
// provider. Credentials are never authored by clients as authoritative facts;
// they are stored encrypted at rest and only ever surfaced to privileged
// admins in masked form. The public API never exposes them.

export const PaymentProviderMode = Object.freeze({
  SANDBOX: "SANDBOX",
  REAL: "REAL"
});

export const PaymentProvider = Object.freeze({
  BKASH: "bkash"
});

const modes = new Set(Object.values(PaymentProviderMode));
const providers = new Set(Object.values(PaymentProvider));

// Credential fields accepted for a provider. Each is a non-empty string.
const credentialFields = new Set(["appKey", "appSecret", "username", "password", "merchantNumber"]);

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalString(value, name) {
  if (value == null || value === "") return null;
  return requiredString(value, name);
}

// Validates and normalizes the credential object. Returns a frozen object with
// only the allowed fields present (nulls omitted). Rejects unknown fields so a
// client cannot smuggle extra data into the stored record.
export function normalizeCredentials(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("credentials must be an object");
  const result = {};
  for (const key of Object.keys(input)) {
    if (!credentialFields.has(key)) throw new TypeError(`unknown credential field: ${key}`);
    const value = optionalString(input[key], key);
    if (value != null) result[key] = value;
  }
  if (Object.keys(result).length === 0) throw new TypeError("at least one credential is required");
  return Object.freeze(result);
}

// Creates a payment provider config record. `credentials` are the normalized
// plaintext credentials (before encryption); the caller is responsible for
// encrypting them before persistence. `active` is server-owned and defaults to
// false so a config is never live until explicitly activated.
export function createPaymentProviderConfig({
  id,
  provider,
  mode,
  credentials,
  active = false,
  createdAt = new Date()
}) {
  const safeProvider = requiredString(provider, "provider").toLowerCase();
  if (!providers.has(safeProvider)) throw new TypeError(`provider is not supported: ${safeProvider}`);
  const safeMode = requiredString(mode, "mode").toUpperCase();
  if (!modes.has(safeMode)) throw new TypeError(`mode is invalid: ${safeMode}`);
  const safeCredentials = normalizeCredentials(credentials);
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) throw new TypeError("createdAt must be a valid timestamp");
  return Object.freeze({
    id: requiredString(id, "id"),
    provider: safeProvider,
    mode: safeMode,
    credentials: safeCredentials,
    active: active === true,
    createdAt: date.toISOString()
  });
}

// Masks credentials for display to privileged admins. Secret-bearing fields are
// replaced with a fixed mask; non-secret fields (e.g. merchantNumber) are kept
// so an admin can confirm which account is configured without exposing secrets.
export function maskCredentials(credentials) {
  const safe = normalizeCredentials(credentials);
  const masked = {};
  for (const key of Object.keys(safe)) {
    if (key === "merchantNumber") masked[key] = safe[key];
    else masked[key] = "••••••••";
  }
  return Object.freeze(masked);
}

export { credentialFields };
