import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { ShipmentError } from "./shipment-service.mjs";

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new ShipmentError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new ShipmentError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new ShipmentError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ShipmentError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new ShipmentError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ShipmentError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof ShipmentError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "SHIPMENT_FORBIDDEN", "Shipment operation is not allowed"];
    if (error.code === "conflict") return [409, "SHIPMENT_CONFLICT", "Shipment conflicts with existing data"];
    if (error.code === "invalid_state") return [409, "INVALID_SHIPMENT_STATE", "Shipment is not in an acceptable state"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Shipment reference is invalid"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Shipment request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleShipmentRequest(request, response, { shipmentService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const prefix = "/api/v1/admin/shipments";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
  if (!shipmentService) { send(response, 503, failure("SHIPMENT_UNAVAILABLE", "Shipments are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const suffix = url.pathname.slice(prefix.length);
  let shipmentId = null;
  let op = null;
  if (suffix) {
    const parts = suffix.slice(1).split("/");
    if (parts.length === 2 && parts[0] && (parts[1] === "ship" || parts[1] === "deliver")) { shipmentId = parts[0]; op = parts[1]; }
    else { send(response, 404, failure("SHIPMENT_NOT_FOUND", "Shipment not found", requestId)); return true; }
    if (!id(shipmentId)) { send(response, 404, failure("SHIPMENT_NOT_FOUND", "Shipment not found", requestId)); return true; }
  }

  const method = request.method ?? "GET";
  const valid = (!suffix && method === "POST") || (shipmentId && op && method === "POST");
  if (!valid) { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    if (!suffix) send(response, 201, { data: await shipmentService.create(cookies.pcx_access, await jsonBody(request)) });
    else if (op === "ship") {
      const body = await jsonBody(request);
      if (typeof body.trackingId !== "string" || !body.trackingId) throw new ShipmentError("invalid_input");
      send(response, 200, { data: await shipmentService.ship(cookies.pcx_access, id(shipmentId), body.trackingId) });
    } else {
      send(response, 200, { data: await shipmentService.deliver(cookies.pcx_access, id(shipmentId)) });
    }
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
