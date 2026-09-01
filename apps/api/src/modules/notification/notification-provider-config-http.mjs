import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { NotificationProviderConfigError } from "./notification-provider-config-service.mjs";

const maxBodyBytes = 16 * 1024;

function send(response, status, body) { response.writeHead(status).end(body == null ? undefined : JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }

function cookies(request) {
  const result = {};
  for (const part of (request.headers?.cookie ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore malformed cookie */ }
  }
  return result;
}

function security(request, allowedOrigins, parsed) {
  if (typeof request.headers?.origin !== "string" || !allowedOrigins?.has(request.headers.origin)) throw new NotificationProviderConfigError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = parsed.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new NotificationProviderConfigError("csrf_invalid");
  const left = Buffer.from(header), right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new NotificationProviderConfigError("csrf_invalid");
}

async function body(request) {
  if (request.headers?.["content-type"]?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new NotificationProviderConfigError("invalid_request");
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new NotificationProviderConfigError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new NotificationProviderConfigError("invalid_request"); }
}

function mapped(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (!(error instanceof NotificationProviderConfigError)) return [500, "INTERNAL_ERROR", "Unexpected server error"];
  const values = {
    forbidden: [403, "FORBIDDEN", "Operation is not allowed"],
    origin_denied: [403, "ORIGIN_DENIED", "Request origin is not allowed"],
    csrf_invalid: [403, "CSRF_INVALID", "CSRF validation failed"],
    not_found: [404, "NOTIFICATION_PROVIDER_NOT_FOUND", "Notification provider not found"],
    invalid_request: [400, "INVALID_REQUEST", "Notification provider request is invalid"],
    invalid_input: [422, "INVALID_INPUT", "Notification provider values are invalid"]
  };
  return values[error.code] ?? [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleNotificationProviderConfigRequest(request, response, { notificationProviderConfigService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/admin/notification-providers/";
  if (!url.pathname.startsWith(prefix)) return false;
  if (!notificationProviderConfigService) { send(response, 503, failure("NOTIFICATION_PROVIDER_UNAVAILABLE", "Notification provider configuration is temporarily unavailable", requestId)); return true; }

  const rest = url.pathname.slice(prefix.length).split("/").filter(Boolean);
  // [provider, "config"]       -> GET list / PUT save
  // [provider, "activate"]     -> POST activate
  // [provider, "config", mode] -> DELETE remove
  const isConfig = rest.length === 2 && rest[1] === "config";
  const isActivate = rest.length === 2 && rest[1] === "activate";
  const isRemove = rest.length === 3 && rest[1] === "config";
  if (!isConfig && !isActivate && !isRemove) { send(response, 404, failure("NOT_FOUND", "Resource not found", requestId)); return true; }
  const provider = rest[0];
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const isList = isConfig && request.method === "GET";
  const isSave = isConfig && request.method === "PUT";
  const isActivateOp = isActivate && request.method === "POST";
  const isDelete = isRemove && request.method === "DELETE";
  if (!isList && !isSave && !isActivateOp && !isDelete) { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const parsed = cookies(request);
  try {
    if (isSave || isActivateOp || isDelete) security(request, allowedOrigins, parsed);
    if (isList) {
      send(response, 200, { data: await notificationProviderConfigService.listConfigs(parsed.pcx_access, provider) });
    } else if (isSave) {
      send(response, 200, { data: await notificationProviderConfigService.saveConfig(parsed.pcx_access, { provider, ...(await body(request)) }) });
    } else if (isActivateOp) {
      send(response, 200, { data: await notificationProviderConfigService.setActiveMode(parsed.pcx_access, { provider, ...(await body(request)) }) });
    } else {
      send(response, 200, { data: await notificationProviderConfigService.removeConfig(parsed.pcx_access, { provider, mode: rest[2] }) });
    }
  } catch (error) {
    const [status, code, message] = mapped(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
