import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { OrderPaymentError } from "./order-payment-service.mjs";

const maxBodyBytes = 32 * 1024;

function send(response, status, body) { response.writeHead(status).end(body == null ? undefined : JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }

function parsedCookies(request) {
  const result = {};
  const header = request.headers?.cookie;
  if (typeof header !== "string") return result;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore malformed cookie */ }
  }
  return result;
}

function requireWriteSecurity(request, allowedOrigins, cookies) {
  const origin = request.headers?.origin;
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new OrderPaymentError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new OrderPaymentError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new OrderPaymentError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new OrderPaymentError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new OrderPaymentError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new OrderPaymentError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof OrderPaymentError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "ORDER_FORBIDDEN", "Order operation is not allowed"];
    if (error.code === "conflict") return [409, "PAYMENT_CONFLICT", "Payment provider transaction already exists"];
    if (error.code === "item_unavailable") return [409, "ITEM_UNAVAILABLE", "The item is no longer available"];
    if (error.code === "invalid_state") return [409, "INVALID_PAYMENT_STATE", "Payment is not in an acceptable state"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Order/payment reference is invalid"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Order/payment request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleOrderPaymentRequest(request, response, { orderPaymentService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/orders";
  const paymentsPrefix = "/api/v1/payments";
  const isOrder = url.pathname === prefix;
  const isPaymentCreate = url.pathname === paymentsPrefix;
  const isPaymentConfirm = url.pathname === `${paymentsPrefix}/confirm`;
  const isBkashCallback = url.pathname === `${paymentsPrefix}/bkash/callback`;
  const isBkashIpn = url.pathname === `${paymentsPrefix}/bkash/ipn`;

  // bKash redirect callback: GET with ?paymentID=... after the customer completes
  // the checkout. No auth/CSRF — the gateway execute() is server-authoritative.
  if (isBkashCallback) {
    if (!orderPaymentService) { send(response, 503, failure("ORDER_PAYMENT_UNAVAILABLE", "Orders and payments are temporarily unavailable", requestId)); return true; }
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    const paymentId = url.searchParams.get("paymentID");
    if (!paymentId || typeof paymentId !== "string") { send(response, 400, failure("INVALID_REQUEST", "paymentID is required", requestId)); return true; }
    try {
      send(response, 200, { data: await orderPaymentService.reconcileBkashPayment(paymentId) });
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  // bKash IPN (server-to-server instant payment notification): POST with a JSON
  // body carrying the paymentID. Same server-authoritative reconciliation as the
  // redirect callback, just delivered machine-to-machine.
  if (isBkashIpn) {
    if (!orderPaymentService) { send(response, 503, failure("ORDER_PAYMENT_UNAVAILABLE", "Orders and payments are temporarily unavailable", requestId)); return true; }
    if (request.method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    let body = null;
    try { body = await jsonBody(request); } catch { body = null; }
    const paymentId = body?.paymentID;
    if (!paymentId || typeof paymentId !== "string") { send(response, 400, failure("INVALID_REQUEST", "paymentID is required", requestId)); return true; }
    try {
      send(response, 200, { data: await orderPaymentService.reconcileBkashPayment(paymentId) });
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  if (!isOrder && !isPaymentCreate && !isPaymentConfirm) return false;
  if (!orderPaymentService) { send(response, 503, failure("ORDER_PAYMENT_UNAVAILABLE", "Orders and payments are temporarily unavailable", requestId)); return true; }
  if (request.method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    const body = await jsonBody(request);
    if (isOrder) send(response, 201, { data: await orderPaymentService.createOrder(cookies.pcx_access, body) });
    else if (isPaymentCreate) send(response, 201, { data: await orderPaymentService.createPayment(cookies.pcx_access, body) });
    else {
      if (typeof body.providerTransactionId !== "string" || !body.providerTransactionId) throw new OrderPaymentError("invalid_input");
      send(response, 200, { data: await orderPaymentService.confirmPayment(cookies.pcx_access, body.providerTransactionId) });
    }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
