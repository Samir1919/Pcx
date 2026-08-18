import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { MerchantListingError } from "./merchant-listing-service.mjs";

const maxBodyBytes = 16 * 1024;
const listQueryKeys = new Set(["cursor", "limit"]);

function send(response, status, body) { response.writeHead(status).end(body == null ? undefined : JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }

function parsedCookies(request) {
  const result = {};
  const header = request.headers?.cookie;
  if (typeof header !== "string") return result;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore */ }
  }
  return result;
}

function exactHeader(request, name, maximum = 256) {
  const value = request.headers?.[name];
  return typeof value === "string" && value.length <= maximum ? value : null;
}

function requireWriteSecurity(request, allowedOrigins, cookies) {
  const origin = exactHeader(request, "origin", 2048);
  if (!origin || !allowedOrigins?.has(origin)) throw new MerchantListingError("origin_denied");
  const header = exactHeader(request, "x-csrf-token");
  const cookie = cookies.pcx_csrf;
  if (!header || typeof cookie !== "string") throw new MerchantListingError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new MerchantListingError("csrf_invalid");
}

async function jsonBody(request) {
  const contentType = exactHeader(request, "content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new MerchantListingError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new MerchantListingError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new MerchantListingError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof MerchantListingError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "FORBIDDEN", "Merchant listing operation is not allowed"];
    if (error.code === "not_found") return [404, "LISTING_NOT_FOUND", "Listing not found"];
    if (error.code === "invalid_state") return [409, "LISTING_NOT_EDITABLE", "Only a DRAFT listing can be edited or archived"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleMerchantListingRequest(request, response, { merchantListingService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/merchant/listings";
  const listPath = url.pathname === prefix;
  const itemMatch = url.pathname.match(/^\/api\/v1\/merchant\/listings\/([^/]+)$/);

  if (!listPath && !itemMatch) return false;
  if (!merchantListingService) { send(response, 503, failure("LISTING_UNAVAILABLE", "Merchant listings are temporarily unavailable", requestId)); return true; }

  if (listPath) {
    if (request.method === "GET") {
      for (const key of url.searchParams.keys()) {
        if (!listQueryKeys.has(key)) { send(response, 400, failure("INVALID_REQUEST", `Unsupported query parameter: ${key}`, requestId)); return true; }
        if (url.searchParams.getAll(key).length > 1) { send(response, 400, failure("INVALID_REQUEST", `Duplicate query parameter: ${key}`, requestId)); return true; }
      }
      const limit = url.searchParams.get("limit") == null ? 50 : Number(url.searchParams.get("limit"));
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) { send(response, 400, failure("INVALID_REQUEST", "Invalid limit", requestId)); return true; }
      const cookies = parsedCookies(request);
      try {
        const result = await merchantListingService.list(cookies.pcx_access, { limit, cursor: url.searchParams.get("cursor") });
        send(response, 200, result);
      } catch (error) {
        const [status, code, message] = map(error);
        send(response, status, failure(code, message, requestId));
      }
      return true;
    }
    if (request.method === "POST") {
      const cookies = parsedCookies(request);
      try {
        requireWriteSecurity(request, allowedOrigins, cookies);
        const body = await jsonBody(request);
        const result = await merchantListingService.createDraft(cookies.pcx_access, body);
        send(response, 201, { data: result });
      } catch (error) {
        const [status, code, message] = map(error);
        send(response, status, failure(code, message, requestId));
      }
      return true;
    }
    send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
    return true;
  }

  // Item operations: PATCH (edit draft) / DELETE (archive draft)
  const listingId = id(itemMatch[1]);
  if (!listingId) { send(response, 404, failure("LISTING_NOT_FOUND", "Listing not found", requestId)); return true; }
  const method = request.method ?? "GET";
  if (method !== "PATCH" && method !== "DELETE") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    if (method === "PATCH") {
      const body = await jsonBody(request);
      const result = await merchantListingService.updateDraft(cookies.pcx_access, listingId, body);
      send(response, 200, { data: result });
    } else {
      const result = await merchantListingService.archiveDraft(cookies.pcx_access, listingId);
      send(response, 200, { data: result });
    }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
