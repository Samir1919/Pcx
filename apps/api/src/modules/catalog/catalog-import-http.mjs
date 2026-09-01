import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { CatalogImportError } from "./catalog-import-service.mjs";

const maxBodyBytes = 2 * 1024 * 1024; // 2 MiB of CSV text

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new CatalogImportError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new CatalogImportError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new CatalogImportError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new CatalogImportError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new CatalogImportError("invalid_input");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new CatalogImportError("invalid_request"); }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof CatalogImportError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "IMPORT_FORBIDDEN", "Catalog import is not allowed"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Catalog import input is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleCatalogImportRequest(request, response, { catalogImportService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  if (url.pathname !== "/api/v1/admin/catalog/import") return false;
  if (!catalogImportService) { send(response, 503, failure("IMPORT_UNAVAILABLE", "Catalog import is temporarily unavailable", requestId)); return true; }
  if (request.method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    const body = await jsonBody(request);
    if (typeof body.csv !== "string" || body.csv.trim().length === 0) throw new CatalogImportError("invalid_input");
    send(response, 200, { data: await catalogImportService.importCsv(cookies.pcx_access, body.csv) });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}