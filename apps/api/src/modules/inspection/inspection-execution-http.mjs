import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { InspectionExecutionError } from "./inspection-execution-service.mjs";

const maxBodyBytes = 64 * 1024;

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new InspectionExecutionError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new InspectionExecutionError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new InspectionExecutionError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new InspectionExecutionError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new InspectionExecutionError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new InspectionExecutionError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof InspectionExecutionError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "INSPECTION_FORBIDDEN", "Inspection operation is not allowed"];
    if (error.code === "item_not_found") return [404, "INVENTORY_ITEM_NOT_FOUND", "Inventory item not found"];
    if (error.code === "template_not_found") return [404, "INSPECTION_TEMPLATE_NOT_FOUND", "Inspection template not found"];
    if (error.code === "not_found") return [404, "INSPECTION_NOT_FOUND", "Inspection not found"];
    if (error.code === "already_in_progress") return [409, "INSPECTION_IN_PROGRESS", "An inspection is already in progress for this item"];
    if (error.code === "invalid_item") return [422, "INVALID_INSPECTION_ITEM", "Inspection template item is invalid"];
    if (error.code === "invalid_state") return [409, "INSPECTION_NOT_EDITABLE", "Inspection is not in an editable state"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Inspection request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleInspectionExecutionRequest(request, response, { inspectionExecutionService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/inspections";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
  if (!inspectionExecutionService) { send(response, 503, failure("INSPECTION_UNAVAILABLE", "Inspections are temporarily unavailable", requestId)); return true; }

  const suffix = url.pathname.slice(prefix.length);
  const inProgressId = suffix.length > 1 ? id(suffix.slice(1)) : null;
  const action = inProgressId ? null : (suffix.length > 1 ? id(suffix.slice(1)) : null);
  const method = request.method ?? "GET";

  // Collection path: POST create, GET list by inventoryItemId.
  if (url.pathname === prefix) {
    if (method === "POST") {
      const cookies = parsedCookies(request);
      try {
        requireWriteSecurity(request, allowedOrigins, cookies);
        send(response, 201, { data: await inspectionExecutionService.start(cookies.pcx_access, await jsonBody(request)) });
      } catch (error) {
        const [status, code, message] = map(error);
        send(response, status, failure(code, message, requestId));
      }
      return true;
    }
    if (method === "GET") {
      const inventoryItemIdValue = url.searchParams.get("inventoryItemId");
      if (!inventoryItemIdValue || [...url.searchParams.keys()].some((key) => key !== "inventoryItemId")) {
        send(response, 400, failure("INVALID_REQUEST", "Query parameter inventoryItemId is required", requestId));
        return true;
      }
      const cookies = parsedCookies(request);
      try {
        send(response, 200, { data: await inspectionExecutionService.list(cookies.pcx_access, inventoryItemIdValue) });
      } catch (error) {
        const [status, code, message] = map(error);
        send(response, status, failure(code, message, requestId));
      }
      return true;
    }
    send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
    return true;
  }

  // Item path with an action segment: /inspections/:id/results|submit|approve|reject
  const parts = suffix.slice(1).split("/").map((part) => {
    try { return decodeURIComponent(part); } catch { return null; }
  });
  if (parts.length !== 2) { send(response, 404, failure("INSPECTION_NOT_FOUND", "Inspection not found", requestId)); return true; }
  const inspectionIdValue = parts[0]?.length <= 128 && !parts[0]?.includes("/") ? parts[0] : null;
  const actionName = parts[1];
  if (!inspectionIdValue) { send(response, 404, failure("INSPECTION_NOT_FOUND", "Inspection not found", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    if (method !== "GET") requireWriteSecurity(request, allowedOrigins, cookies);
    if (method === "GET" && actionName === "results") {
      send(response, 200, { data: await inspectionExecutionService.get(cookies.pcx_access, inspectionIdValue) });
    } else if (method === "PUT" && actionName === "results") {
      send(response, 200, { data: await inspectionExecutionService.putResult(cookies.pcx_access, inspectionIdValue, await jsonBody(request)) });
    } else if (method === "POST" && actionName === "submit") {
      send(response, 200, { data: await inspectionExecutionService.submit(cookies.pcx_access, inspectionIdValue) });
    } else if (method === "POST" && actionName === "approve") {
      send(response, 200, { data: await inspectionExecutionService.approve(cookies.pcx_access, inspectionIdValue) });
    } else if (method === "POST" && actionName === "reject") {
      send(response, 200, { data: await inspectionExecutionService.reject(cookies.pcx_access, inspectionIdValue) });
    } else if (method === "POST" && actionName === "override") {
      send(response, 200, { data: await inspectionExecutionService.override(cookies.pcx_access, inspectionIdValue, await jsonBody(request)) });
    } else {
      send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
      return true;
    }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
