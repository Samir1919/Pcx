import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "./auth-service.mjs";
import { IdentityActionError } from "./identity-action-service.mjs";

// `Secure` cookies require HTTPS and are the default (safe for any non-dev
// environment). Only an explicit development run over `http://localhost` omits
// the attribute; production always keeps it for the auth boundary.
const secureCookie = process.env.NODE_ENV === "development" ? "" : "Secure; ";

const sessionRoutes = new Set(["register", "login", "refresh", "logout", "verify-mfa"]);
const identityActionRoutes = new Set(["verify-contact", "verify-contact-code", "forgot-password", "reset-password"]);
const routes = new Set([...sessionRoutes, ...identityActionRoutes]);
const fields = Object.freeze({
  register: new Set(["email", "phone", "fullName", "password"]),
  login: new Set(["contact", "password"]),
  refresh: new Set(),
  logout: new Set(),
  "verify-mfa": new Set(["challengeId", "credential"]),
  "verify-contact": new Set(["token"]),
  "verify-contact-code": new Set(["contact", "code"]),
  "forgot-password": new Set(["contact"]),
  "reset-password": new Set(["token", "password"])
});
const maxBodyBytes = 16 * 1024;

class HttpAuthError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function errorBody(code, message, requestId) {
  return { error: { code, message, requestId } };
}

function send(response, status, body) {
  response.writeHead(status).end(JSON.stringify(body));
}

function cookies(request) {
  const header = request.headers?.cookie;
  if (typeof header !== "string") return {};
  const parsed = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    try { parsed[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* malformed cookies are ignored */ }
  }
  return parsed;
}

function exactHeader(request, name, maximum = 512) {
  const value = request.headers?.[name];
  return typeof value === "string" && value.length <= maximum ? value : null;
}

function requireOrigin(request, allowedOrigins) {
  const origin = exactHeader(request, "origin", 2048);
  if (!origin || !allowedOrigins.has(origin)) throw new HttpAuthError("ORIGIN_DENIED", 403, "Request origin is not allowed");
}

function requireCsrf(request, parsedCookies) {
  const header = exactHeader(request, "x-csrf-token", 256);
  const cookie = parsedCookies.pcx_csrf;
  if (!header || typeof cookie !== "string") throw new HttpAuthError("CSRF_INVALID", 403, "CSRF validation failed");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new HttpAuthError("CSRF_INVALID", 403, "CSRF validation failed");
}

async function jsonBody(request) {
  const contentType = exactHeader(request, "content-type", 256)?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpAuthError("INVALID_REQUEST", 400, "Content-Type must be application/json");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new HttpAuthError("INVALID_REQUEST", 400, "Request body is too large");
    chunks.push(bytes);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpAuthError("INVALID_REQUEST", 400, "Request body must be valid JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpAuthError("INVALID_REQUEST", 400, "Request body must be a JSON object");
  return body;
}

function validateFields(action, body) {
  for (const key of Object.keys(body)) if (!fields[action].has(key)) throw new HttpAuthError("INVALID_REQUEST", 400, `Unsupported field: ${key}`);
  if (action === "register") {
    if (typeof body.password !== "string" || (!body.email && !body.phone)) throw new HttpAuthError("INVALID_REQUEST", 400, "Email or phone and password are required");
  }
  if (action === "login" && (typeof body.contact !== "string" || typeof body.password !== "string")) {
    throw new HttpAuthError("INVALID_REQUEST", 400, "Contact and password are required");
  }
  if (action === "verify-mfa" && (typeof body.challengeId !== "string" || !body.challengeId || typeof body.credential !== "string" || !body.credential)) {
    throw new HttpAuthError("INVALID_REQUEST", 400, "Challenge ID and credential are required");
  }
  if ((action === "refresh" || action === "logout") && Object.keys(body).length > 0) throw new HttpAuthError("INVALID_REQUEST", 400, "Request body must be empty");
  if (action === "verify-contact" && (typeof body.token !== "string" || !body.token)) throw new HttpAuthError("INVALID_REQUEST", 400, "Token is required");
  if (action === "verify-contact-code" && (typeof body.contact !== "string" || !body.contact.trim() || typeof body.code !== "string" || !body.code)) throw new HttpAuthError("INVALID_REQUEST", 400, "Contact and code are required");
  if (action === "forgot-password" && (typeof body.contact !== "string" || !body.contact.trim())) throw new HttpAuthError("INVALID_REQUEST", 400, "Contact is required");
  if (action === "reset-password" && (typeof body.token !== "string" || !body.token || typeof body.password !== "string")) throw new HttpAuthError("INVALID_REQUEST", 400, "Token and password are required");
}

function context(request, requestId) {
  const remoteAddress = request.socket?.remoteAddress;
  return {
    requestId,
    ipHash: typeof remoteAddress === "string" ? createHash("sha256").update(remoteAddress).digest() : null,
    userAgent: exactHeader(request, "user-agent", 512)
  };
}

function sessionCookies(session, csrfToken) {
  const accessExpiry = new Date(session.accessExpiresAt).toUTCString();
  const refreshExpiry = new Date(session.refreshExpiresAt).toUTCString();
  return [
    `pcx_access=${encodeURIComponent(session.accessCredential)}; Path=/; Expires=${accessExpiry}; ${secureCookie}HttpOnly; SameSite=Strict`,
    `pcx_refresh=${encodeURIComponent(session.refreshCredential)}; Path=/api/v1/auth; Expires=${refreshExpiry}; ${secureCookie}HttpOnly; SameSite=Strict`,
    `pcx_csrf=${encodeURIComponent(csrfToken)}; Path=/; Expires=${refreshExpiry}; ${secureCookie}SameSite=Strict`
  ];
}

// MFA challenges have no session yet, but the follow-up `verify-mfa` call is a
// write and therefore requires CSRF. Issue a short-lived CSRF-only cookie so
// the second step can complete without a session.
function csrfOnlyCookie(token) {
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toUTCString();
  return `pcx_csrf=${encodeURIComponent(token)}; Path=/; Expires=${expiry}; ${secureCookie}SameSite=Strict`;
}

function clearCookies() {
  return [
    `pcx_access=; Path=/; Max-Age=0; ${secureCookie}HttpOnly; SameSite=Strict`,
    `pcx_refresh=; Path=/api/v1/auth; Max-Age=0; ${secureCookie}HttpOnly; SameSite=Strict`,
    `pcx_csrf=; Path=/; Max-Age=0; ${secureCookie}SameSite=Strict`
  ];
}

function mapped(error) {
  if (error instanceof HttpAuthError) return error;
  if (error instanceof TypeError) return new HttpAuthError("INVALID_INPUT", 422, "Request values are invalid");
  if (error instanceof IdentityActionError) {
    if (error.code === "rate_limited") return new HttpAuthError("RATE_LIMITED", 429, "Too many requests");
    return new HttpAuthError("INVALID_TOKEN", 400, "Action token is invalid or expired");
  }
  if (!(error instanceof AuthenticationError)) return new HttpAuthError("INTERNAL_ERROR", 500, "Unexpected server error");
  if (error.code === "rate_limited") return new HttpAuthError("RATE_LIMITED", 429, "Too many requests");
  if (error.code === "contact_unavailable") return new HttpAuthError("CONTACT_UNAVAILABLE", 409, "Contact is unavailable");
  if (error.code === "mfa_unavailable") return new HttpAuthError("MFA_UNAVAILABLE", 503, "Multi-factor authentication is unavailable");
  if (error.code === "invalid_mfa") return new HttpAuthError("MFA_FAILED", 401, "Multi-factor verification failed");
  return new HttpAuthError("UNAUTHENTICATED", 401, "Authentication failed");
}

export async function handleAuthRequest(request, response, { authService, identityActionService, allowedOrigins, requestId, csrfToken = () => randomBytes(32).toString("base64url") }) {
  const url = new URL(request.url, "http://pcx.local");
  if (!url.pathname.startsWith("/api/v1/auth/")) return false;
  const action = url.pathname.slice("/api/v1/auth/".length);
  if (!routes.has(action) || action.includes("/")) return false;
  if (request.method !== "POST") {
    send(response, 405, errorBody("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
    return true;
  }
  const selectedService = identityActionRoutes.has(action) ? identityActionService : authService;
  if (!selectedService || !allowedOrigins || allowedOrigins.size === 0) {
    send(response, 503, errorBody("AUTH_UNAVAILABLE", "Authentication is temporarily unavailable", requestId));
    return true;
  }
  try {
    if (url.searchParams.size > 0) throw new HttpAuthError("INVALID_REQUEST", 400, "Query parameters are not supported");
    requireOrigin(request, allowedOrigins);
    const parsedCookies = cookies(request);
    if (action === "refresh" || action === "logout") requireCsrf(request, parsedCookies);
    if (action === "verify-mfa") requireCsrf(request, parsedCookies);
    const body = await jsonBody(request);
    validateFields(action, body);
    const authContext = context(request, requestId);
    if (action === "register") {
      const result = await authService.register(body, authContext);
      send(response, 201, { data: result.customer });
    } else if (action === "login") {
      const result = await authService.login(body, authContext);
      if (result.status === "mfa_required") {
        response.setHeader("set-cookie", [csrfOnlyCookie(csrfToken())]);
        send(response, 202, { data: { status: result.status, challenge: result.challenge } });
      } else {
        response.setHeader("set-cookie", sessionCookies(result.session, csrfToken()));
        send(response, 200, { data: { identity: result.identity } });
      }
    } else if (action === "verify-mfa") {
      const result = await authService.verifyMfa({ challengeId: body.challengeId, credential: body.credential }, authContext);
      response.setHeader("set-cookie", sessionCookies(result.session, csrfToken()));
      send(response, 200, { data: { status: result.status, identity: result.identity } });
    } else if (action === "refresh") {
      const result = await authService.refresh({ refreshCredential: parsedCookies.pcx_refresh }, authContext);
      response.setHeader("set-cookie", sessionCookies(result.session, csrfToken()));
      send(response, 200, { data: { status: result.status } });
    } else if (action === "logout") {
      await authService.logout({ refreshCredential: parsedCookies.pcx_refresh }, authContext);
      response.setHeader("set-cookie", clearCookies());
      response.writeHead(204).end();
    } else if (action === "verify-contact") {
      const result = await identityActionService.verifyContact({ credential: body.token }, authContext);
      send(response, 200, { data: { status: result.status } });
    } else if (action === "verify-contact-code") {
      const result = await identityActionService.verifyContactByCode({ contact: body.contact, credential: body.code }, authContext);
      send(response, 200, { data: { status: result.status } });
    } else if (action === "forgot-password") {
      await identityActionService.requestPasswordReset({ contact: body.contact }, authContext);
      send(response, 202, { data: { status: "accepted" } });
    } else {
      await identityActionService.resetPassword({ credential: body.token, password: body.password }, authContext);
      response.setHeader("set-cookie", clearCookies());
      response.writeHead(204).end();
    }
  } catch (error) {
    if ((action === "refresh" && error instanceof AuthenticationError && error.code === "invalid_refresh") || action === "reset-password") {
      response.setHeader("set-cookie", clearCookies());
    }
    const failure = mapped(error);
    send(response, failure.status, errorBody(failure.code, failure.message, requestId));
  }
  return true;
}
