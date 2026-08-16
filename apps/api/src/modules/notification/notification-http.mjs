import { AuthenticationError } from "../identity/auth-service.mjs";
import { NotificationError } from "./notification-service.mjs";

function send(response, status, body) { response.writeHead(status).end(body == null ? undefined : JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof NotificationError) {
    if (error.code === "forbidden") return [403, "NOTIFICATION_FORBIDDEN", "Notification operation is not allowed"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Notification reference is invalid"];
    return [422, "INVALID_INPUT", "Notification request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleNotificationRequest(request, response, { notificationService, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  if (url.pathname !== "/api/v1/admin/notifications") return false;
  if (!notificationService) { send(response, 503, failure("NOTIFICATION_UNAVAILABLE", "Notifications are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
  if (request.method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    send(response, 422, failure("INVALID_INPUT", "Notification request is invalid", requestId));
    return true;
  }

  try {
    const result = await notificationService.create(request.headers?.cookie ? { pcx_access: (request.headers.cookie.match(/pcx_access=([^;]+)/) ?? [])[1] } : undefined, body);
    send(response, 201, { data: result });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
