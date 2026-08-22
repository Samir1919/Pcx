import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { SiteFooterError } from "./site-footer-service.mjs";

const maxBodyBytes = 64 * 1024;

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new SiteFooterError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new SiteFooterError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new SiteFooterError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new SiteFooterError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new SiteFooterError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new SiteFooterError("invalid_request"); }
}

function mapped(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof SiteFooterError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "SITE_FOOTER_FORBIDDEN", "Site footer operation is not allowed"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Site footer input is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleSiteFooterRequest(request, response, { siteFooterService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");

  // Public read: GET /api/v1/footer
  if (url.pathname === "/api/v1/footer") {
    if (!siteFooterService) { send(response, 503, failure("SITE_FOOTER_UNAVAILABLE", "Site footer is temporarily unavailable", requestId)); return true; }
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    try {
      send(response, 200, await siteFooterService.publicFooter());
    } catch (error) {
      const [status, code, message] = mapped(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  // Admin read/write: GET/PUT /api/v1/admin/footer
  if (url.pathname !== "/api/v1/admin/footer") return false;
  if (!siteFooterService) { send(response, 503, failure("SITE_FOOTER_UNAVAILABLE", "Site footer is temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    if (request.method === "GET") {
      send(response, 200, await siteFooterService.adminFooter(cookies.pcx_access));
      return true;
    }
    if (request.method !== "PUT") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    requireWriteSecurity(request, allowedOrigins, cookies);
    const body = await jsonBody(request);
    const result = await siteFooterService.save(cookies.pcx_access, body, { requestId });
    send(response, 200, result);
    return true;
  } catch (error) {
    const [status, code, message] = mapped(error);
    send(response, status, failure(code, message, requestId));
    return true;
  }
}
