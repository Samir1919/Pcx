import { AuthenticationError } from "../identity/auth-service.mjs";
import { ReportsError } from "./operations-report-service.mjs";

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

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof ReportsError && error.code === "forbidden") return [403, "REPORTS_FORBIDDEN", "Reports operation is not allowed"];
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleOperationsReportRequest(request, response, { operationsReportService, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  if (url.pathname !== "/api/v1/admin/reports/operations") return false;
  if (!operationsReportService) { send(response, 503, failure("REPORTS_UNAVAILABLE", "Reports are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
  if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    const result = await operationsReportService.dashboard(cookies.pcx_access);
    send(response, 200, { data: result });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
