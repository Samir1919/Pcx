import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { ListingError } from "./listing-service.mjs";

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new ListingError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new ListingError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new ListingError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ListingError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new ListingError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ListingError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof ListingError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "LISTING_FORBIDDEN", "Listing operation is not allowed"];
    if (error.code === "conflict") return [409, "LISTING_CONFLICT", "Listing conflicts with existing data"];
    if (error.code === "invalid_state") return [409, "STATE_TRANSITION_NOT_ALLOWED", "Listing state transition is not allowed"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Listing reference is invalid"];
    if (error.code === "item_not_approved") return [409, "ITEM_NOT_APPROVED", "Only approved inventory items can be listed"];
    if (error.code === "not_found") return [404, "LISTING_NOT_FOUND", "Listing not found"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Listing request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleListingRequest(request, response, { listingService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");

  // Public listing search: GET /api/v1/listings
  if (url.pathname === "/api/v1/listings") {
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    if (!listingService) { send(response, 503, failure("LISTING_UNAVAILABLE", "Listings are temporarily unavailable", requestId)); return true; }
    const allowedKeys = new Set(["categoryId", "brandId", "q", "cursor", "limit", "sort"]);
    for (const key of url.searchParams.keys()) {
      if (!allowedKeys.has(key)) { send(response, 400, failure("INVALID_REQUEST", `Unsupported query parameter: ${key}`, requestId)); return true; }
      if (url.searchParams.getAll(key).length > 1) { send(response, 400, failure("INVALID_REQUEST", `Duplicate query parameter: ${key}`, requestId)); return true; }
    }
    const limit = url.searchParams.get("limit") == null ? 20 : Number(url.searchParams.get("limit"));
    const sort = url.searchParams.get("sort") ?? "newest";
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !new Set(["newest", "price_asc", "price_desc"]).has(sort)) {
      send(response, 400, failure("INVALID_REQUEST", "Invalid limit or sort", requestId)); return true;
    }
    try {
      const result = await listingService.searchPublic({
        categoryId: url.searchParams.get("categoryId"),
        brandId: url.searchParams.get("brandId"),
        q: url.searchParams.get("q"),
        cursor: url.searchParams.get("cursor"),
        limit,
        sort
      });
      send(response, 200, result);
    } catch (error) {
      send(response, 400, failure("INVALID_REQUEST", "Invalid search filters", requestId));
    }
    return true;
  }

  // Public related listings: GET /api/v1/passport/:pcxId/related
  const related = url.pathname.match(/^\/api\/v1\/passport\/([^/]+)\/related$/);
  if (related) {
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (!listingService) { send(response, 503, failure("LISTING_UNAVAILABLE", "Listings are temporarily unavailable", requestId)); return true; }
    try {
      const result = await listingService.related(id(related[1]));
      if (result) send(response, 200, { data: result });
      else send(response, 404, failure("PASSPORT_NOT_FOUND", "Passport not found", requestId));
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  // Public passport read: GET /api/v1/passport/:pcxId
  const passport = url.pathname.match(/^\/api\/v1\/passport\/([^/]+)$/);
  if (passport) {
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (!listingService) { send(response, 503, failure("LISTING_UNAVAILABLE", "Listings are temporarily unavailable", requestId)); return true; }
    try {
      const result = await listingService.publicPassport(id(passport[1]));
      if (result) send(response, 200, { data: result });
      else send(response, 404, failure("PASSPORT_NOT_FOUND", "Passport not found", requestId));
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  const prefix = "/api/v1/admin/listings";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
  if (!listingService) { send(response, 503, failure("LISTING_UNAVAILABLE", "Listings are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const suffix = url.pathname.slice(prefix.length);
  const method = request.method ?? "GET";
  const listMode = !suffix && method === "GET";
  if (listMode) {
    const cookies = parsedCookies(request);
    try {
      send(response, 200, await listingService.listAdmin(cookies.pcx_access, {}));
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  let listingId = null;
  let op = null;
  if (suffix) {
    const parts = suffix.slice(1).split("/");
    if (parts.length === 1 && parts[0] === "prices") op = "setPrice";
    else if (parts.length === 2 && parts[1] === "publish") { op = "publish"; listingId = parts[0]; }
    else if (parts.length === 1 && parts[0]) { listingId = parts[0]; }
    else { send(response, 404, failure("LISTING_NOT_FOUND", "Listing not found", requestId)); return true; }
  }

  const valid = (!suffix && method === "POST") || (op === "publish" && method === "POST") || (op === "setPrice" && method === "POST");
  if (!valid) { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    const body = await jsonBody(request);
    if (!suffix) send(response, 201, { data: await listingService.createDraft(cookies.pcx_access, body) });
    else if (op === "publish") send(response, 200, { data: await listingService.publish(cookies.pcx_access, id(listingId), body) });
    else send(response, 201, { data: await listingService.setPrice(cookies.pcx_access, body) });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
