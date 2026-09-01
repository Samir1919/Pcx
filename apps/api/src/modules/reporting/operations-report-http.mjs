import { AuthenticationError } from "../identity/auth-service.mjs";
import { ReportsError } from "./operations-report-service.mjs";

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
  const path = url.pathname;

  const isOperations = path === "/api/v1/admin/reports/operations";
  const isBi = path === "/api/v1/admin/reports/bi";
  const isExport = path === "/api/v1/admin/reports/operations/export";
  if (!isOperations && !isBi && !isExport) return false;
  if (!operationsReportService) { send(response, 503, failure("REPORTS_UNAVAILABLE", "Reports are temporarily unavailable", requestId)); return true; }
  if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  if (isExport) {
    if (url.searchParams.get("format") !== "csv" || url.searchParams.size > 1) { send(response, 400, failure("INVALID_REQUEST", "format=csv is required", requestId)); return true; }
  } else if (url.searchParams.size > 0) {
    send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true;
  }

  const cookies = parsedCookies(request);
  try {
    if (isExport) {
      const csv = await operationsReportService.exportOperationsCsv(cookies.pcx_access);
      sendText(response, 200, "text/csv; charset=utf-8", csv, "operations-report.csv");
    } else if (isBi) {
      send(response, 200, { data: await operationsReportService.biDashboard(cookies.pcx_access) });
    } else {
      send(response, 200, { data: await operationsReportService.dashboard(cookies.pcx_access) });
    }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
