import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { PaymentProviderConfigError } from "./payment-provider-config-service.mjs";

const maxBodyBytes = 16 * 1024;

function send(response, status, body) { response.writeHead(status).end(body == null ? undefined : JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }

function cookies(request) {
  const result = {};
  for (const part of (request.headers?.cookie ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore malformed cookie */ }
  }
  return result;
}

function security(request, allowedOrigins, parsed) {
  if (typeof request.headers?.origin !== "string" || !allowedOrigins?.has(request.headers.origin)) throw new PaymentProviderConfigError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = parsed.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new PaymentProviderConfigError("csrf_invalid");
  const left = Buffer.from(header), right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new PaymentProviderConfigError("csrf_invalid");
}

async function body(request) {
  if (request.headers?.["content-type"]?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new PaymentProviderConfigError("invalid_request");
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new PaymentProviderConfigError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new PaymentProviderConfigError("invalid_request"); }
}

function mapped(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (!(error instanceof PaymentProviderConfigError)) return [500, "INTERNAL_ERROR", "Unexpected server error"];
  const values = {
    forbidden: [403, "FORBIDDEN", "Operation is not allowed"],
    origin_denied: [403, "ORIGIN_DENIED", "Request origin is not allowed"],
    csrf_invalid: [403, "CSRF_INVALID", "CSRF validation failed"],
    not_found: [404, "PAYMENT_PROVIDER_NOT_FOUND", "Payment provider not found"],
    invalid_request: [400, "INVALID_REQUEST", "Payment provider request is invalid"],
    invalid_input: [422, "INVALID_INPUT", "Payment provider values are invalid"]
  };
  return values[error.code] ?? [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handlePaymentProviderConfigRequest(request, response, { paymentProviderConfigService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/admin/payment-providers/";
  if (!url.pathname.startsWith(prefix)) return false;
  if (!paymentProviderConfigService) { send(response, 503, failure("PAYMENT_PROVIDER_UNAVAILABLE", "Payment provider configuration is temporarily unavailable", requestId)); return true; }

  const rest = url.pathname.slice(prefix.length).split("/").filter(Boolean);
  // Expected shapes:
  //   [provider, "config"]            -> GET list / PUT save
  //   [provider, "activate"]          -> POST activate
  if (rest.length !== 2) { send(response, 404, failure("NOT_FOUND", "Resource not found", requestId)); return true; }
  const [provider, action] = rest;
  if (action !== "config" && action !== "activate") { send(response, 404, failure("NOT_FOUND", "Resource not found", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const isList = action === "config" && request.method === "GET";
  const isSave = action === "config" && request.method === "PUT";
  const isActivate = action === "activate" && request.method === "POST";
  if (!isList && !isSave && !isActivate) { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const parsed = cookies(request);
  try {
    // GET (list) is a same-origin read; browsers do not send an Origin header
    // on same-origin GETs, so only mutating requests run the Origin + CSRF
    // double-submit gate. Authorization is still enforced by the service.
    if (isSave || isActivate) security(request, allowedOrigins, parsed);
    if (isList) {
      send(response, 200, { data: await paymentProviderConfigService.listConfigs(parsed.pcx_access, provider) });
    } else if (isSave) {
      send(response, 200, { data: await paymentProviderConfigService.saveConfig(parsed.pcx_access, { provider, ...(await body(request)) }) });
    } else {
      send(response, 200, { data: await paymentProviderConfigService.setActiveMode(parsed.pcx_access, { provider, ...(await body(request)) }) });
    }
  } catch (error) {
    const [status, code, message] = mapped(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
