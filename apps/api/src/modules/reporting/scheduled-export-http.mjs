import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { ScheduledExportError } from "./scheduled-export-service.mjs";

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
    try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore */ }
  }
  return result;
}

function requireWriteSecurity(request, allowedOrigins, cookies) {
  const origin = request.headers?.origin;
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new ScheduledExportError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new ScheduledExportError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new ScheduledExportError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ScheduledExportError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new ScheduledExportError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ScheduledExportError("invalid_request"); }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof ScheduledExportError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "EXPORT_FORBIDDEN", "Scheduled export operation is not allowed"];
    if (error.code === "not_found") return [404, "EXPORT_NOT_FOUND", "Scheduled export not found"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Scheduled export input is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleScheduledExportRequest(request, response, { scheduledExportService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/admin/scheduled-exports";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
  if (!scheduledExportService) { send(response, 503, failure("EXPORTS_UNAVAILABLE", "Scheduled exports are temporarily unavailable", requestId)); return true; }

  const method = request.method ?? "GET";
  const cookies = parsedCookies(request);
  try {
    // DELETE /api/v1/admin/scheduled-exports/:id — cancel a scheduled export.
    if (url.pathname !== prefix) {
      const exportId = decodeURIComponent(url.pathname.slice(prefix.length + 1));
      if (!exportId || exportId.includes("/") || url.searchParams.size > 0) { send(response, 404, failure("EXPORT_NOT_FOUND", "Scheduled export not found", requestId)); return true; }
      if (method !== "DELETE") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
      requireWriteSecurity(request, allowedOrigins, cookies);
      send(response, 200, { data: await scheduledExportService.remove(cookies.pcx_access, exportId) });
      return true;
    }

    if (method === "GET") {
      if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
      send(response, 200, { data: await scheduledExportService.list(cookies.pcx_access) });
      return true;
    }
    if (method === "POST") {
      requireWriteSecurity(request, allowedOrigins, cookies);
      const body = await jsonBody(request);
      send(response, 201, { data: await scheduledExportService.create(cookies.pcx_access, body) });
      return true;
    }
    send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}