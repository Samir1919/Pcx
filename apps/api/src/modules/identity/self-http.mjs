import { createHash, timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "./auth-service.mjs";

function accessCookie(request) {
  const header = request.headers?.cookie;
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1 || part.slice(0, index).trim() !== "pcx_access") continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
  }
  return null;
}

function parsedCookies(request) {
  const header = request.headers?.cookie;
  if (typeof header !== "string") return {};
  const result = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore */ }
  }
  return result;
}

function send(response, status, body) { response.writeHead(status).end(JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }

function requireOrigin(request, allowedOrigins) {
  const origin = request.headers?.origin;
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new SelfWriteError("origin_denied");
}

function requireCsrf(request, cookies) {
  const header = request.headers?.["x-csrf-token"];
  const csrf = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof csrf !== "string") throw new SelfWriteError("csrf_invalid");
  const a = Buffer.from(header);
  const b = Buffer.from(csrf);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new SelfWriteError("csrf_invalid");
}

class SelfWriteError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function context(request, requestId) {
  const remoteAddress = request.socket?.remoteAddress;
  return {
    requestId,
    ipHash: typeof remoteAddress === "string" ? createHash("sha256").update(remoteAddress).digest() : null,
    userAgent: typeof request.headers?.["user-agent"] === "string" ? request.headers["user-agent"].slice(0, 512) : null
  };
}

function mapError(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof AuthenticationError && error.code === "invalid_credentials") return [401, "INVALID_CREDENTIALS", "Current password is incorrect"];
  if (error instanceof AuthenticationError && error.code === "rate_limited") return [429, "RATE_LIMITED", "Too many requests"];
  if (error instanceof SelfWriteError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "invalid_input") return [422, "INVALID_INPUT", "Request values are invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

// The self (profile) surface: read own identity, edit name/phone, and change
// password. Email is immutable here; it belongs to the identity/verification
// boundary. Writes carry the double-submit CSRF token and exact origin.
export async function handleSelfRequest(request, response, { authService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const method = request.method ?? "GET";

  // Self surface only accepts read / PATCH on /me; any other verb is rejected
  // here (including POST on /me, which keeps the historical 405 contract).
  if (url.pathname === "/api/v1/me" && method !== "GET" && method !== "PATCH") {
    send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
    return true;
  }

  if (url.pathname === "/api/v1/me" && method === "GET") {
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (!authService) { send(response, 503, failure("AUTH_UNAVAILABLE", "Authentication is temporarily unavailable", requestId)); return true; }
    try {
      const identity = await authService.authenticateAccess({ accessCredential: accessCookie(request) });
      send(response, 200, { data: identity });
    } catch (error) {
      const [status, code, message] = mapError(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  if (url.pathname === "/api/v1/me" && method === "PATCH") {
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (!authService || !allowedOrigins || allowedOrigins.size === 0) { send(response, 503, failure("AUTH_UNAVAILABLE", "Authentication is temporarily unavailable", requestId)); return true; }
    const cookies = parsedCookies(request);
    try {
      requireOrigin(request, allowedOrigins);
      requireCsrf(request, cookies);
      const body = await readJson(request);
      if (body == null || Array.isArray(body)) throw new SelfWriteError("invalid_input");
      const fullName = body.fullName === undefined ? undefined : (typeof body.fullName === "string" ? body.fullName : null);
      const phone = body.phone === undefined ? undefined : (typeof body.phone === "string" ? body.phone : null);
      if (fullName === undefined && phone === undefined) throw new SelfWriteError("invalid_input");
      const identity = await authService.updateProfile({ accessCredential: accessCookie(request), fullName, phone }, context(request, requestId));
      send(response, 200, { data: identity });
    } catch (error) {
      const [status, code, message] = mapError(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  if (url.pathname === "/api/v1/me/password" && method === "POST") {
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    if (!authService || !allowedOrigins || allowedOrigins.size === 0) { send(response, 503, failure("AUTH_UNAVAILABLE", "Authentication is temporarily unavailable", requestId)); return true; }
    const cookies = parsedCookies(request);
    try {
      requireOrigin(request, allowedOrigins);
      requireCsrf(request, cookies);
      const body = await readJson(request);
      if (typeof body?.currentPassword !== "string" || typeof body?.newPassword !== "string") throw new SelfWriteError("invalid_input");
      const result = await authService.changePassword({ accessCredential: accessCookie(request), currentPassword: body.currentPassword, newPassword: body.newPassword }, context(request, requestId));
      send(response, 200, { data: result });
    } catch (error) {
      const [status, code, message] = mapError(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  return false;
}

async function readJson(request) {
  const contentType = request.headers?.["content-type"];
  if (typeof contentType !== "string" || contentType.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new SelfWriteError("invalid_input");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 16 * 1024) throw new SelfWriteError("invalid_input");
    chunks.push(bytes);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new SelfWriteError("invalid_input"); }
}
