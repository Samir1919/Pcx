import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { ItemCostError } from "./item-cost-service.mjs";

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new ItemCostError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new ItemCostError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new ItemCostError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ItemCostError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new ItemCostError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ItemCostError("invalid_request"); }
}

function itemId(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof ItemCostError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "INVENTORY_FORBIDDEN", "Inventory cost operation is not allowed"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Inventory item reference is invalid"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Inventory cost entry is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

// Routes: GET /api/v1/admin/inventory/:id/costs (ledger + totals)
//         POST /api/v1/admin/inventory/:id/costs (append a cost entry)
// Registered before the inventory handler so the `/costs` suffix is not 404'd
// by the inventory resource's path guard.
export async function handleItemCostRequest(request, response, { itemCostService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/admin/inventory/";
  if (!url.pathname.startsWith(prefix) || !url.pathname.endsWith("/costs")) return false;

  const middle = url.pathname.slice(prefix.length, -"/costs".length);
  const inventoryItemId = itemId(middle);
  if (!inventoryItemId) { send(response, 404, failure("INVENTORY_NOT_FOUND", "Inventory item not found", requestId)); return true; }
  if (!itemCostService) { send(response, 503, failure("INVENTORY_UNAVAILABLE", "Inventory costs are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    if (method === "POST") {
      requireWriteSecurity(request, allowedOrigins, cookies);
      send(response, 201, { data: await itemCostService.add(cookies.pcx_access, inventoryItemId, await jsonBody(request)) });
    } else {
      send(response, 200, { data: await itemCostService.listForItem(cookies.pcx_access, inventoryItemId) });
    }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
