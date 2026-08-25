import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { MediaError } from "./media-service.mjs";
import { MediaStorageError } from "./local-media-storage.mjs";
import { MAX_UPLOAD_BYTES } from "./local-media-storage.mjs";

function send(response, status, body, headers = {}) {
  response.writeHead(status, headers);
  if (body == null) { response.end(); return; }
  if (typeof body === "string" || Buffer.isBuffer(body) || body instanceof Uint8Array) { response.end(body); return; }
  response.end(JSON.stringify(body));
}
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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new MediaError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new MediaError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new MediaError("csrf_invalid");
}

async function binaryBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_UPLOAD_BYTES) throw new MediaStorageError("invalid_input");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof MediaError || error instanceof MediaStorageError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "MEDIA_FORBIDDEN", "Media operation is not allowed"];
    if (error.code === "unsupported_type" || error.code === "invalid_input") return [422, "INVALID_UPLOAD", "Upload type or size is not allowed"];
    if (error.code === "not_found") return [404, "MEDIA_NOT_FOUND", "Media not found"];
    return [500, "INTERNAL_ERROR", "Unexpected server error"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleMediaRequest(request, response, { mediaService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");

  // Upload + list routes.
  const uploadMatch = url.pathname.match(/^\/api\/v1\/sell-requests\/([^/]+)\/media$/)
    || url.pathname.match(/^\/api\/v1\/inspections\/([^/]+)\/media$/)
    || url.pathname.match(/^\/api\/v1\/admin\/listings\/([^/]+)\/media$/);
  const readMatch = url.pathname.match(/^\/api\/v1\/media\/([^/]+)$/);
  const listMatch = url.pathname.match(/^\/api\/v1\/sell-requests\/([^/]+)\/media$/)
    || url.pathname.match(/^\/api\/v1\/inspections\/([^/]+)\/media$/)
    || url.pathname.match(/^\/api\/v1\/admin\/listings\/([^/]+)\/media$/);

  if (!uploadMatch && !readMatch && !listMatch) return false;
  if (!mediaService) { send(response, 503, failure("MEDIA_UNAVAILABLE", "Media is temporarily unavailable", requestId)); return true; }

  const method = request.method ?? "GET";
  const cookies = parsedCookies(request);

  // List media for a resource (GET on the same paths).
  if (listMatch && method === "GET" && !readMatch) {
    const resourceId = id(listMatch[1]);
    if (!resourceId) { send(response, 404, failure("MEDIA_NOT_FOUND", "Media not found", requestId)); return true; }
    try {
      let result;
      if (url.pathname.startsWith("/api/v1/sell-requests/")) result = await mediaService.listSellRequestMedia(cookies.pcx_access, resourceId);
      else if (url.pathname.startsWith("/api/v1/inspections/")) result = await mediaService.listInspectionMedia(cookies.pcx_access, resourceId);
      else result = await mediaService.listListingMedia(resourceId);
      send(response, 200, { data: result });
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  // Public read of a media object by id.
  if (readMatch && method === "GET") {
    try {
      const mediaId = id(readMatch[1]);
      if (!mediaId) { send(response, 404, failure("MEDIA_NOT_FOUND", "Media not found", requestId)); return true; }
      const { media, buffer } = await mediaService.read(cookies.pcx_access, mediaId);
      send(response, 200, buffer, { "content-type": media.mimeType, "cache-control": "public, max-age=31536000, immutable" });
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  if (!uploadMatch || method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
  const resourceId = id(uploadMatch[1]);
  if (!resourceId) { send(response, 404, failure("MEDIA_NOT_FOUND", "Media not found", requestId)); return true; }

  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    const buffer = await binaryBody(request);
    let result;
    if (url.pathname.startsWith("/api/v1/sell-requests/")) result = await mediaService.addSellRequestMedia(cookies.pcx_access, resourceId, buffer);
    else if (url.pathname.startsWith("/api/v1/inspections/")) result = await mediaService.addInspectionMedia(cookies.pcx_access, resourceId, buffer);
    else result = await mediaService.addListingMedia(cookies.pcx_access, resourceId, buffer);
    send(response, 201, { data: result });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
