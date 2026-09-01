import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { WarrantyPolicyError } from "./warranty-policy-service.mjs";

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new WarrantyPolicyError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new WarrantyPolicyError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new WarrantyPolicyError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new WarrantyPolicyError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new WarrantyPolicyError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new WarrantyPolicyError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof WarrantyPolicyError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "FORBIDDEN", "Warranty policy operation is not allowed"];
    if (error.code === "conflict") return [409, "POLICY_CONFLICT", "A warranty policy with this name already exists"];
    if (error.code === "not_found") return [404, "POLICY_NOT_FOUND", "Warranty policy not found"];
    if (error.code === "invalid_state") return [409, "INVALID_POLICY_STATE", "Warranty policy is not in an acceptable state"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Warranty policy request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleWarrantyPolicyRequest(request, response, { warrantyPolicyService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/admin/warranty-policies";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
  if (!warrantyPolicyService) { send(response, 503, failure("WARRANTY_POLICY_UNAVAILABLE", "Warranty policies are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const cookies = parsedCookies(request);
  const method = request.method ?? "GET";

  // Collection: GET list / POST create.
  if (url.pathname === prefix) {
    try {
      if (method === "GET") { send(response, 200, await warrantyPolicyService.list(cookies.pcx_access)); return true; }
      if (method === "POST") {
        requireWriteSecurity(request, allowedOrigins, cookies);
        send(response, 201, { data: await warrantyPolicyService.create(cookies.pcx_access, await jsonBody(request)) });
        return true;
      }
      send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
      return true;
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
      return true;
    }
  }

  // Item path: POST /:id/archive
  const suffix = url.pathname.slice(prefix.length);
  const parts = suffix.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[1] !== "archive") { send(response, 404, failure("POLICY_NOT_FOUND", "Warranty policy not found", requestId)); return true; }
  const policyId = id(parts[0]);
  if (!policyId) { send(response, 404, failure("POLICY_NOT_FOUND", "Warranty policy not found", requestId)); return true; }
  if (method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    send(response, 200, { data: await warrantyPolicyService.archive(cookies.pcx_access, policyId) });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
