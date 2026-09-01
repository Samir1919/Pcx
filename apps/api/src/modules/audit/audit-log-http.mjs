import { AuthenticationError } from "../identity/auth-service.mjs";
import { AuditLogError } from "./audit-log-service.mjs";

function send(response, status, body) { response.writeHead(status).end(body == null ? undefined : JSON.stringify(body)); }
function sendText(response, status, contentType, body, filename = null) {
  const headers = { "content-type": contentType };
  if (filename) headers["content-disposition"] = `attachment; filename="${filename}"`;
  response.writeHead(status, headers).end(body);
}
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

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof AuditLogError && error.code === "forbidden") return [403, "AUDIT_FORBIDDEN", "Audit access is not allowed"];
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleAuditLogRequest(request, response, { auditLogService, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const path = url.pathname;
  const isList = path === "/api/v1/admin/audit-logs";
  const isExport = path === "/api/v1/admin/audit-logs/export";
  if (!isList && !isExport) return false;
  if (!auditLogService) { send(response, 503, failure("AUDIT_UNAVAILABLE", "Audit logs are temporarily unavailable", requestId)); return true; }
  if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  if (isExport) {
    if (url.searchParams.get("format") !== "ndjson" || url.searchParams.size > 1) { send(response, 400, failure("INVALID_REQUEST", "format=ndjson is required", requestId)); return true; }
  }

  const cookies = parsedCookies(request);
  try {
    if (isExport) {
      const ndjson = await auditLogService.exportNdjson(cookies.pcx_access, {
        entityType: url.searchParams.get("entityType"),
        entityId: url.searchParams.get("entityId")
      });
      sendText(response, 200, "application/x-ndjson; charset=utf-8", ndjson, "audit-logs.ndjson");
    } else {
      const filters = { entityType: url.searchParams.get("entityType"), entityId: url.searchParams.get("entityId") };
      send(response, 200, { data: await auditLogService.list(cookies.pcx_access, filters) });
    }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
