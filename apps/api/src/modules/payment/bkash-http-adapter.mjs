// Real bKash HTTP adapter (sandbox-only).
//
// Implements the bKash URL-based Checkout HTTP operations researched from
// https://developer.bka.sh (llms.txt + tokenized-checkout references):
//
//   Grant Token    POST {base}/tokenized/checkout/token/grant
//   Create Payment POST {base}/tokenized/checkout/create   (mode "0011")
//   Execute Payment POST {base}/tokenized/checkout/execute
//   Query Payment  GET  {base}/tokenized/checkout/payment/status
//   Refund         POST {base}/v2/tokenized-checkout/refund/payment/transaction
//
// Grant token uses `username`/`password` as request headers (not Basic auth) and
// a JSON body of `{ app_key, app_secret }`. Every other call authenticates with
// the id_token in `Authorization` and the app key in `X-App-Key`.
//
// Sandbox-only: a REAL base URL is rejected at construction so live credentials
// can never be used without explicit human approval.

export const BKASH_SANDBOX_BASE_URL = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
export const BKASH_LIVE_BASE_URL = "https://tokenized.pay.bka.sh/v1.2.0-beta";

const SANDBOX_HOSTS = new Set(["tokenized.sandbox.bka.sh"]);

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function parseBaseUrl(value) {
  const url = new URL(requiredString(value, "baseUrl"));
  if (url.protocol !== "https:") throw new TypeError("bKash baseUrl must use https");
  if (!SANDBOX_HOSTS.has(url.hostname)) throw new TypeError("only the bKash sandbox host is authorized; live mode requires human approval");
  return url.toString().replace(/\/$/, "");
}

export function createBkashHttpAdapter({ baseUrl = BKASH_SANDBOX_BASE_URL, credentials, fetchImpl = globalThis.fetch, timeoutMs = 30_000, clock = () => new Date() }) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");
  const safeBase = parseBaseUrl(baseUrl);
  const appKey = requiredString(credentials?.appKey, "credentials.appKey");
  const appSecret = requiredString(credentials?.appSecret, "credentials.appSecret");
  const username = requiredString(credentials?.username, "credentials.username");
  const password = requiredString(credentials?.password, "credentials.password");

  let cachedToken = null;

  async function request(path, { method = "POST", headers = {}, body = null } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${safeBase}${path}`, {
        method,
        headers: { accept: "application/json", ...headers },
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
      if (!response.ok) {
        const message = payload?.errorMessage ?? payload?.statusMessage ?? `bKash request failed (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  async function grantToken() {
    if (cachedToken && cachedToken.expiresAt > clock()) return cachedToken.idToken;
    const payload = await request("/tokenized/checkout/token/grant", {
      headers: { "content-type": "application/json", username, password },
      body: { app_key: appKey, app_secret: appSecret }
    });
    const idToken = requiredString(payload?.id_token, "id_token");
    const expiresIn = Number(payload?.expires_in ?? 3600);
    const expiresAt = new Date(clock().getTime() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 3600 * 1000));
    cachedToken = { idToken, expiresAt };
    return idToken;
  }

  const authHeaders = async () => ({ authorization: await grantToken(), "x-app-key": appKey });

  return Object.freeze({
    async createPayment({ amount, currency = "BDT", merchantInvoiceNumber, payerReference = "", callbackURL, intent = "sale" } = {}) {
      const body = {
        mode: "0011",
        payerReference,
        callbackURL: requiredString(callbackURL, "callbackURL"),
        amount: String(amount),
        currency,
        intent,
        merchantInvoiceNumber: requiredString(merchantInvoiceNumber, "merchantInvoiceNumber")
      };
      const payload = await request("/tokenized/checkout/create", {
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body
      });
      if (payload?.statusCode && payload.statusCode !== "0000") throw new Error(payload.statusMessage ?? `bKash create payment failed (${payload.statusCode})`);
      return Object.freeze({
        paymentID: requiredString(payload?.paymentID, "paymentID"),
        bkashURL: payload?.bkashURL ?? null,
        transactionStatus: payload?.transactionStatus ?? "Initiated"
      });
    },

    async executePayment(paymentId) {
      const payload = await request("/tokenized/checkout/execute", {
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: { paymentID: requiredString(paymentId, "paymentId") }
      });
      return Object.freeze({
        paymentID: payload?.paymentID ?? paymentId,
        trxID: payload?.trxID ?? null,
        transactionStatus: payload?.transactionStatus ?? null,
        statusCode: payload?.statusCode ?? null
      });
    },

    async queryPayment(paymentId) {
      const payload = await request("/tokenized/checkout/payment/status", {
        method: "GET",
        headers: await authHeaders()
      });
      return Object.freeze({
        paymentID: payload?.paymentID ?? paymentId,
        trxID: payload?.trxID ?? null,
        transactionStatus: payload?.transactionStatus ?? null
      });
    },

    async refund({ paymentId, trxId, amount, sku = "", reason = "Refund" } = {}) {
      const payload = await request("/v2/tokenized-checkout/refund/payment/transaction", {
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: {
          paymentId: requiredString(paymentId, "paymentId"),
          trxId: requiredString(trxId, "trxId"),
          refundAmount: String(amount),
          sku,
          reason
        }
      });
      return Object.freeze({
        refundTrxID: payload?.refundTrxId ?? null,
        transactionStatus: payload?.refundTransactionStatus ?? null,
        refundAmount: payload?.refundAmount ?? null
      });
    }
  });
}
