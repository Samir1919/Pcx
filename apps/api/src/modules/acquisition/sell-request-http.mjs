import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { AcquisitionError } from "./acquisition-service.mjs";
import { SellRequestError } from "./sell-request-service.mjs";

const maxBodyBytes = 16 * 1024;

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new SellRequestError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new SellRequestError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new SellRequestError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new SellRequestError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new SellRequestError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new SellRequestError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof AcquisitionError) {
    if (error.code === "forbidden") return [403, "ACQUISITION_FORBIDDEN", "Acquisition operation is not allowed"];
    if (error.code === "not_found") return [404, "ACQUISITION_NOT_FOUND", "Acquisition resource not found"];
    return [500, "INTERNAL_ERROR", "Unexpected server error"];
  }
  if (error instanceof SellRequestError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "not_found") return [404, "SELL_REQUEST_NOT_FOUND", "Sell request not found"];
    if (error.code === "invalid_state") return [409, "STATE_TRANSITION_NOT_ALLOWED", "Sell request state transition is not allowed"];
    if (error.code === "forbidden") return [403, "SELL_REQUEST_FORBIDDEN", "Sell request operation is not allowed"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Sell request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleSellRequestRequest(request, response, { sellRequestService, acquisitionService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");

  // Admin queue: GET /api/v1/admin/sell-requests (read-only, non-owner-scoped).
  if (url.pathname === "/api/v1/admin/sell-requests") {
    if (!sellRequestService) { send(response, 503, failure("SELL_REQUEST_UNAVAILABLE", "Sell requests are temporarily unavailable", requestId)); return true; }
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    const cookies = parsedCookies(request);
    try {
      send(response, 200, await sellRequestService.listAdmin(cookies.pcx_access));
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  // Admin offer + acquisition reads: GET /api/v1/admin/sell-requests/:id/offers
  // and /:id/acquisition. Handled before the detail read so the suffix is not
  // rejected by that handler slash-free id guard.
  const adminSubPrefix = "/api/v1/admin/sell-requests/";
  if (url.pathname.startsWith(adminSubPrefix)) {
    const tail = url.pathname.slice(adminSubPrefix.length);
    const slash = tail.indexOf("/");
    if (slash > 0) {
      const subRequestId = id(tail.slice(0, slash));
      const subresource = tail.slice(slash + 1);
      if (subRequestId && (subresource === "offers" || subresource === "acquisition")) {
        if (!acquisitionService) { send(response, 503, failure("ACQUISITION_UNAVAILABLE", "Acquisition is temporarily unavailable", requestId)); return true; }
        if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
        if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
        const cookies = parsedCookies(request);
        try {
          if (subresource === "offers") send(response, 200, await acquisitionService.listOffersForAdmin(cookies.pcx_access, subRequestId));
          else send(response, 200, await acquisitionService.getAcquisitionForAdmin(cookies.pcx_access, subRequestId));
        } catch (error) {
          const [status, code, message] = map(error);
          send(response, status, failure(code, message, requestId));
        }
        return true;
      }
    }
  }


  // Admin detail read: GET /api/v1/admin/sell-requests/:id
  const adminPrefix = "/api/v1/admin/sell-requests/";
  if (url.pathname.startsWith(adminPrefix) && !url.pathname.endsWith("/transition")) {
    if (!sellRequestService) { send(response, 503, failure("SELL_REQUEST_UNAVAILABLE", "Sell requests are temporarily unavailable", requestId)); return true; }
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    const rawId = url.pathname.slice(adminPrefix.length);
    const requestIdValue = id(rawId);
    if (!requestIdValue) { send(response, 404, failure("SELL_REQUEST_NOT_FOUND", "Sell request not found", requestId)); return true; }
    const cookies = parsedCookies(request);
    try {
      send(response, 200, { data: await sellRequestService.getAdmin(cookies.pcx_access, requestIdValue) });
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  // Admin lifecycle transition: POST /api/v1/admin/sell-requests/:id/transition
  const transitionPrefix = "/api/v1/admin/sell-requests/";
  if (url.pathname.startsWith(transitionPrefix) && url.pathname.endsWith("/transition")) {
    if (!sellRequestService) { send(response, 503, failure("SELL_REQUEST_UNAVAILABLE", "Sell requests are temporarily unavailable", requestId)); return true; }
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (request.method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    const rawId = url.pathname.slice(transitionPrefix.length, -"/transition".length);
    const requestIdValue = id(rawId);
    if (!requestIdValue) { send(response, 404, failure("SELL_REQUEST_NOT_FOUND", "Sell request not found", requestId)); return true; }
    const cookies = parsedCookies(request);
    try {
      requireWriteSecurity(request, allowedOrigins, cookies);
      const body = await jsonBody(request);
      send(response, 200, { data: await sellRequestService.transition(cookies.pcx_access, requestIdValue, body.toStatus ?? body.status) });
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  const prefix = "/api/v1/sell-requests";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
  if (!sellRequestService) { send(response, 503, failure("SELL_REQUEST_UNAVAILABLE", "Sell requests are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const suffix = url.pathname.slice(prefix.length);
  let requestIdValue = null;
  let submit = false;
  let offers = false;
  if (suffix) {
    const parts = suffix.slice(1).split("/");
    const validShape = parts.length === 1
      || (parts.length === 2 && parts[1] === "submit")
      || (parts.length === 2 && parts[1] === "offers");
    if (!validShape || parts.some((part) => !part)) { send(response, 404, failure("SELL_REQUEST_NOT_FOUND", "Sell request not found", requestId)); return true; }
    requestIdValue = id(parts[0]);
    submit = parts.length === 2 && parts[1] === "submit";
    offers = parts.length === 2 && parts[1] === "offers";
    if (!requestIdValue) { send(response, 404, failure("SELL_REQUEST_NOT_FOUND", "Sell request not found", requestId)); return true; }
  }

  const method = request.method ?? "GET";
  const valid = (!requestIdValue && new Set(["GET", "POST"]).has(method))
    || (requestIdValue && !submit && !offers && method === "GET")
    || (requestIdValue && offers && method === "GET")
    || (requestIdValue && submit && method === "POST");
  if (!valid) { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    if (method !== "GET") requireWriteSecurity(request, allowedOrigins, cookies);
    if (method === "GET" && !requestIdValue) send(response, 200, { data: await sellRequestService.list(cookies.pcx_access) });
    else if (method === "GET" && offers) send(response, 200, await acquisitionService.listOffersForCustomer(cookies.pcx_access, requestIdValue));
    else if (method === "GET") send(response, 200, { data: await sellRequestService.get(cookies.pcx_access, requestIdValue) });
    else if (submit) send(response, 200, { data: await sellRequestService.submit(cookies.pcx_access, requestIdValue) });
    else send(response, 201, { data: await sellRequestService.create(cookies.pcx_access, await jsonBody(request)) });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
