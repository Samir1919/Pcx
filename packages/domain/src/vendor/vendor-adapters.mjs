/**
 * Sandbox vendor adapters.
 *
 * These adapters implement provider-neutral injected contracts so the platform
 * can integrate with real providers later without changing service internals.
 * They are deterministic, secret-free, and validate all inputs. No adapter ever
 * touches real credentials, customer data, or private evidence.
 *
 * Contracts:
 * - Notification dispatcher: `dispatchers[channel].send(notification)` as used
 *   by `createNotificationService`.
 * - Payment gateway: `gateway.charge({ amount, currency, reference })` returning
 *   `{ providerTransactionId, status }`.
 * - Courier: `courier.createShipment({ reference, address })` returning
 *   `{ trackingId, status }`.
 */

const CHANNELS = new Set(["EMAIL", "SMS", "PUSH"]);
const CURRENCIES = new Set(["USD", "EUR", "GBP", "BDT"]);
const PAYMENT_STATUSES = new Set(["INITIATED", "CONFIRMED", "FAILED"]);
const COURIER_STATUSES = new Set(["CREATED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]);

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
};

const asOptionalString = (value, field) => (value == null || value === "" ? null : asNonEmptyString(value, field));

const asAmount = (value) => {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError("amount must be a positive finite number");
  return value;
};

const asCurrency = (value) => {
  const currency = asNonEmptyString(value, "currency").toUpperCase();
  if (!CURRENCIES.has(currency)) throw new TypeError(`currency is not supported: ${currency}`);
  return currency;
};

const asAddress = (address) => {
  if (!address || typeof address !== "object") throw new TypeError("address must be an object");
  const line1 = asNonEmptyString(address.line1, "address.line1");
  const city = asNonEmptyString(address.city, "address.city");
  const country = asNonEmptyString(address.country, "address.country");
  return Object.freeze({
    line1,
    line2: asOptionalString(address.line2, "address.line2"),
    city,
    postalCode: asOptionalString(address.postalCode, "address.postalCode"),
    country
  });
};

const SECRET_PATTERNS = [/token/i, /secret/i, /credential/i, /password/i, /api[_ -]?key/i, /authorization/i, /bearer/i];

const assertNoSecrets = (value, field) => {
  if (typeof value === "string" && SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new TypeError(`${field} may contain a secret`);
  }
};

/**
 * Sandbox notification dispatcher factory. Returns an object matching the
 * `dispatchers[channel].send(notification)` contract used by
 * `createNotificationService`. Validates the notification shape, rejects
 * secret-bearing payloads, and delegates delivery to an injected `send`
 * (default: records delivery and resolves). Never throws on a valid input.
 */
export const createSandboxNotificationDispatcher = ({ channel, send = async () => ({ delivered: true }) } = {}) => {
  const safeChannel = asNonEmptyString(channel, "channel").toUpperCase();
  if (!CHANNELS.has(safeChannel)) throw new TypeError(`notification channel is not supported: ${safeChannel}`);
  if (typeof send !== "function") throw new TypeError("send must be a function");
  return Object.freeze({
    channel: safeChannel,
    async send(notification) {
      if (!notification || typeof notification !== "object") throw new TypeError("notification must be an object");
      const id = asNonEmptyString(notification.id, "notification.id");
      const payload = notification.payloadSnapshot ?? {};
      assertNoSecrets(JSON.stringify(payload), "notification.payloadSnapshot");
      const outcome = await send({ notification: { ...notification, id }, channel: safeChannel });
      return Object.freeze({ id, channel: safeChannel, delivered: outcome?.delivered !== false });
    }
  });
};

/**
 * Sandbox payment gateway factory. Returns a provider-neutral gateway with a
 * single `charge` method. Idempotent by reference: charging the same reference
 * twice returns the same provider transaction id. Never touches real
 * credentials. A `charge` implementation may be injected for deterministic
 * testing; the default returns a deterministic sandbox transaction id.
 */
export const createSandboxPaymentGateway = ({ charge = defaultSandboxCharge } = {}) => {
  if (typeof charge !== "function") throw new TypeError("charge must be a function");
  const seen = new Map();
  return Object.freeze({
    async charge({ amount, currency, reference } = {}) {
      const safeAmount = asAmount(amount);
      const safeCurrency = asCurrency(currency);
      const safeReference = asNonEmptyString(reference, "reference");
      if (seen.has(safeReference)) return seen.get(safeReference);
      const outcome = await charge({ amount: safeAmount, currency: safeCurrency, reference: safeReference });
      const providerTransactionId = asNonEmptyString(outcome?.providerTransactionId, "providerTransactionId");
      const status = asNonEmptyString(outcome?.status ?? "CONFIRMED", "status").toUpperCase();
      if (!PAYMENT_STATUSES.has(status)) throw new TypeError(`payment status is invalid: ${status}`);
      const result = Object.freeze({ providerTransactionId, status, amount: safeAmount, currency: safeCurrency, reference: safeReference });
      seen.set(safeReference, result);
      return result;
    }
  });
};

const defaultSandboxCharge = async ({ reference }) => ({
  providerTransactionId: `sandbox-pay-${reference}`,
  status: "CONFIRMED"
});

/**
 * Sandbox courier factory. Returns a provider-neutral courier with a single
 * `createShipment` method. Deterministic and secret-free. A `createShipment`
 * implementation may be injected for deterministic testing; the default returns
 * a deterministic sandbox tracking id.
 */
export const createSandboxCourier = ({ createShipment = defaultSandboxCreateShipment } = {}) => {
  if (typeof createShipment !== "function") throw new TypeError("createShipment must be a function");
  return Object.freeze({
    async createShipment({ reference, address } = {}) {
      const safeReference = asNonEmptyString(reference, "reference");
      const safeAddress = asAddress(address);
      const outcome = await createShipment({ reference: safeReference, address: safeAddress });
      const trackingId = asNonEmptyString(outcome?.trackingId, "trackingId");
      const status = asNonEmptyString(outcome?.status ?? "CREATED", "status").toUpperCase();
      if (!COURIER_STATUSES.has(status)) throw new TypeError(`courier status is invalid: ${status}`);
      return Object.freeze({ trackingId, status, reference: safeReference });
    }
  });
};

const defaultSandboxCreateShipment = async ({ reference }) => ({
  trackingId: `sandbox-trk-${reference}`,
  status: "CREATED"
});
