import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { ReturnRequestError } from "./return-request-service.mjs";

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new ReturnRequestError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new ReturnRequestError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new ReturnRequestError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ReturnRequestError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new ReturnRequestError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ReturnRequestError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof ReturnRequestError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "RETURN_FORBIDDEN", "Return operation is not allowed"];
    if (error.code === "conflict") return [409, "RETURN_CONFLICT", "Return already exists for this item"];
    if (error.code === "invalid_state") return [409, "INVALID_RETURN_STATE", "Return is not in an acceptable state"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Return reference is invalid"];
    if (error.code === "not_found") return [404, "RETURN_NOT_FOUND", "Return request not found"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Return request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleReturnRequest(request, response, { returnRequestService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/returns";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
  if (!returnRequestService) { send(response, 503, failure("RETURN_UNAVAILABLE", "Returns are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const method = request.method ?? "GET";
  const suffix = url.pathname.slice(prefix.length);
  if (!suffix && method === "GET") {
    const cookies = parsedCookies(request);
    try {
      send(response, 200, await returnRequestService.list(cookies.pcx_access));
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  let returnId = null;
  let op = null;
  if (suffix) {
    const parts = suffix.slice(1).split("/");
    if (parts.length === 2 && parts[0] && ["approve", "receive", "refund"].includes(parts[1])) { returnId = parts[0]; op = parts[1]; }
    else { send(response, 404, failure("RETURN_NOT_FOUND", "Return request not found", requestId)); return true; }
    if (!id(returnId)) { send(response, 404, failure("RETURN_NOT_FOUND", "Return request not found", requestId)); return true; }
  }

  const valid = (!suffix && method === "POST") || (returnId && op && method === "POST");
  if (!valid) { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    if (!suffix) send(response, 201, { data: await returnRequestService.create(cookies.pcx_access, await jsonBody(request)) });
    else if (op === "approve") send(response, 200, { data: await returnRequestService.approve(cookies.pcx_access, id(returnId)) });
    else if (op === "receive") send(response, 200, { data: await returnRequestService.receive(cookies.pcx_access, id(returnId)) });
    else {
      const body = await jsonBody(request);
      if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0) throw new ReturnRequestError("invalid_input");
      send(response, 200, { data: await returnRequestService.settleRefund(cookies.pcx_access, id(returnId), body.amount) });
    }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
