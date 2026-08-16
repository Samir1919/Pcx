import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "./auth-service.mjs";
import { AddressError } from "./address-service.mjs";

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new AddressError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new AddressError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new AddressError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new AddressError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new AddressError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new AddressError("invalid_request"); }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof AddressError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "not_found") return [404, "ADDRESS_NOT_FOUND", "Address not found"];
    if (error.code === "ineligible") return [403, "ADDRESS_FORBIDDEN", "Address operation is not allowed"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Address request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleAddressRequest(request, response, { addressService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/me/addresses";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
  if (!addressService) { send(response, 503, failure("ADDRESS_UNAVAILABLE", "Addresses are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
  const suffix = url.pathname.slice(prefix.length);
  let addressId = null;
  if (suffix) {
    try { addressId = decodeURIComponent(suffix.slice(1)); } catch { addressId = null; }
    if (!addressId || addressId.includes("/") || addressId.length > 128) { send(response, 404, failure("ADDRESS_NOT_FOUND", "Address not found", requestId)); return true; }
  }
  const method = request.method ?? "GET";
  const valid = (!addressId && new Set(["GET", "POST"]).has(method)) || (addressId && new Set(["PATCH", "DELETE"]).has(method));
  if (!valid) { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
  const cookies = parsedCookies(request);
  try {
    if (method !== "GET") requireWriteSecurity(request, allowedOrigins, cookies);
    if (method === "GET") send(response, 200, { data: await addressService.list(cookies.pcx_access) });
    else if (method === "POST") send(response, 201, { data: await addressService.create(cookies.pcx_access, await jsonBody(request)) });
    else if (method === "PATCH") send(response, 200, { data: await addressService.update(cookies.pcx_access, addressId, await jsonBody(request)) });
    else { await addressService.delete(cookies.pcx_access, addressId); send(response, 204); }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
