import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { SellTaxonomyError } from "./sell-taxonomy-service.mjs";

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new SellTaxonomyError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new SellTaxonomyError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new SellTaxonomyError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new SellTaxonomyError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new SellTaxonomyError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new SellTaxonomyError("invalid_request"); }
}

// Icon uploads are raw image bytes (application/octet-stream), bounded to the
// media module's upload cap. The media module re-validates type + size on save.
const MAX_ICON_BYTES = 8 * 1024 * 1024;
async function binaryBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_ICON_BYTES) throw new SellTaxonomyError("invalid_input");
    chunks.push(bytes);
  }
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) throw new SellTaxonomyError("invalid_input");
  return buffer;
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function mapped(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof SellTaxonomyError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "SELL_TAXONOMY_FORBIDDEN", "Sell taxonomy operation is not allowed"];
    if (error.code === "not_found") return [404, "SELL_TAXONOMY_NOT_FOUND", "Sell taxonomy record not found"];
    if (error.code === "already_exists") return [409, "SELL_TAXONOMY_CONFLICT", "Sell taxonomy entry already exists"];
    if (error.code === "unavailable") return [503, "SELL_TAXONOMY_UNAVAILABLE", "Sell taxonomy is temporarily unavailable"];
    if (error.code === "malware_detected") return [422, "MALWARE_DETECTED", "Upload failed a security scan and was rejected"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Sell taxonomy reference is invalid"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Sell taxonomy input is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

function matchAdmin(url) {
  const prefix = "/api/v1/admin/sell-entry-config";
  if (url.pathname === prefix) return { op: "list" };
  if (!url.pathname.startsWith(`${prefix}/`)) return null;
  const rest = url.pathname.slice(prefix.length + 1).split("/");
  if (rest.length === 1 && rest[0]) return { op: "entry", entryKey: rest[0] };
  if (rest.length === 2 && rest[0] && rest[1] === "components") return { op: "components", entryKey: rest[0] };
  if (rest.length === 2 && rest[0] && rest[1] === "icon") return { op: "icon", entryKey: rest[0] };
  if (rest.length === 3 && rest[0] && rest[1] === "components" && rest[2]) return { op: "component", entryKey: rest[0], role: rest[2] };
  return null;
}

export async function handleSellTaxonomyRequest(request, response, { sellTaxonomyService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");

  // Public read: GET /api/v1/sell-taxonomy
  if (url.pathname === "/api/v1/sell-taxonomy") {
    if (!sellTaxonomyService) { send(response, 503, failure("SELL_TAXONOMY_UNAVAILABLE", "Sell taxonomy is temporarily unavailable", requestId)); return true; }
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    try {
      send(response, 200, await sellTaxonomyService.publicTaxonomy());
    } catch (error) {
      const [status, code, message] = mapped(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  const route = matchAdmin(url);
  if (!route) return false;
  if (!sellTaxonomyService) { send(response, 503, failure("SELL_TAXONOMY_UNAVAILABLE", "Sell taxonomy is temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    if (route.op === "list") {
      if (request.method === "GET") {
        send(response, 200, await sellTaxonomyService.listAdmin(cookies.pcx_access));
        return true;
      }
      if (request.method === "POST") {
        requireWriteSecurity(request, allowedOrigins, cookies);
        const body = await jsonBody(request);
        const result = await sellTaxonomyService.createEntry(cookies.pcx_access, body, { requestId });
        send(response, 201, { data: result.data });
        return true;
      }
      send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
      return true;
    }
    const context = { requestId };

    if (route.op === "entry" && request.method === "DELETE") {
      requireWriteSecurity(request, allowedOrigins, cookies);
      const result = await sellTaxonomyService.deleteEntry(cookies.pcx_access, id(route.entryKey), context);
      send(response, 200, { data: result });
      return true;
    }

    if (route.op === "components" && request.method === "POST") {
      requireWriteSecurity(request, allowedOrigins, cookies);
      const body = await jsonBody(request);
      const result = await sellTaxonomyService.createComponent(cookies.pcx_access, id(route.entryKey), body, context);
      send(response, 201, { data: result });
      return true;
    }

    if (route.op === "component" && request.method === "DELETE") {
      requireWriteSecurity(request, allowedOrigins, cookies);
      const result = await sellTaxonomyService.deleteComponent(cookies.pcx_access, id(route.entryKey), id(route.role), context);
      send(response, 200, { data: result });
      return true;
    }

    // Custom icon image upload (POST) and revert-to-emoji (DELETE).
    if (route.op === "icon") {
      if (request.method !== "POST" && request.method !== "DELETE") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
      requireWriteSecurity(request, allowedOrigins, cookies);
      if (request.method === "POST") {
        const buffer = await binaryBody(request);
        const result = await sellTaxonomyService.setEntryIcon(cookies.pcx_access, id(route.entryKey), buffer, context);
        send(response, 201, { data: result });
        return true;
      }
      const result = await sellTaxonomyService.clearEntryIcon(cookies.pcx_access, id(route.entryKey), context);
      send(response, 200, { data: result });
      return true;
    }

    if (request.method !== "PATCH") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    requireWriteSecurity(request, allowedOrigins, cookies);
    const body = await jsonBody(request);
    let result;
    if (route.op === "entry") {
      result = await sellTaxonomyService.updateEntry(cookies.pcx_access, id(route.entryKey), body, context);
    } else {
      result = await sellTaxonomyService.updateComponent(cookies.pcx_access, id(route.entryKey), id(route.role), body, context);
    }
    send(response, 200, { data: result });
  } catch (error) {
    const [status, code, message] = mapped(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
