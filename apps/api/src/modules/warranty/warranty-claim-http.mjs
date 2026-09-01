import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { WarrantyClaimError } from "./warranty-claim-service.mjs";

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new WarrantyClaimError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new WarrantyClaimError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new WarrantyClaimError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new WarrantyClaimError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new WarrantyClaimError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new WarrantyClaimError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof WarrantyClaimError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "WARRANTY_FORBIDDEN", "Warranty/claim operation is not allowed"];
    if (error.code === "conflict") return [409, "WARRANTY_CONFLICT", "Warranty already exists for this item"];
    if (error.code === "invalid_state") return [409, "INVALID_WARRANTY_STATE", "Warranty/claim is not in an acceptable state"];
    if (error.code === "not_found") return [404, "CLAIM_NOT_FOUND", "Claim not found"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Warranty/claim reference is invalid"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Warranty/claim request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleWarrantyClaimRequest(request, response, { warrantyClaimService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const warranties = "/api/v1/admin/warranties";
  const claims = "/api/v1/admin/claims";
  const customerClaim = "/api/v1/claims";
  const claimInspectionMatch = url.pathname.match(/^\/api\/v1\/admin\/claims\/([^/]+)\/inspection$/);
  const claimShipmentMatch = url.pathname.match(/^\/api\/v1\/admin\/claims\/([^/]+)\/shipment$/);
  let op = null;
  if (url.pathname === warranties) op = "createWarranty";
  else if (url.pathname === claims) op = "createClaim";
  else if (url.pathname === `${claims}/resolve`) op = "resolveClaim";
  else if (url.pathname === customerClaim) op = "createClaimCustomer";
  else if (!claimInspectionMatch && !claimShipmentMatch) return false;

  if (!warrantyClaimService) { send(response, 503, failure("WARRANTY_UNAVAILABLE", "Warranty/claims are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  // Claim → inspection link: POST /api/v1/admin/claims/:id/inspection
  if (claimInspectionMatch) {
    if (request.method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    const claimId = id(claimInspectionMatch[1]);
    if (!claimId) { send(response, 404, failure("CLAIM_NOT_FOUND", "Claim not found", requestId)); return true; }
    const cookies = parsedCookies(request);
    try {
      requireWriteSecurity(request, allowedOrigins, cookies);
      const body = await jsonBody(request);
      send(response, 200, { data: await warrantyClaimService.linkInspection(cookies.pcx_access, claimId, body.inspectionId) });
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  // Claim → shipment (carrier pickup) link: POST /api/v1/admin/claims/:id/shipment
  if (claimShipmentMatch) {
    if (request.method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    const claimId = id(claimShipmentMatch[1]);
    if (!claimId) { send(response, 404, failure("CLAIM_NOT_FOUND", "Claim not found", requestId)); return true; }
    const cookies = parsedCookies(request);
    try {
      requireWriteSecurity(request, allowedOrigins, cookies);
      const body = await jsonBody(request);
      send(response, 200, { data: await warrantyClaimService.linkShipment(cookies.pcx_access, claimId, body.shipmentId) });
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  const method = request.method ?? "GET";
  if (method === "GET" && (op === "createWarranty" || op === "createClaim")) {
    const cookies = parsedCookies(request);
    try {
      const data = op === "createWarranty" ? await warrantyClaimService.listWarranties(cookies.pcx_access) : await warrantyClaimService.listClaims(cookies.pcx_access);
      send(response, 200, data);
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }
  if (method !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  const cookies = parsedCookies(request);
  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    const body = await jsonBody(request);
    let result;
    if (op === "createWarranty") result = await warrantyClaimService.createWarranty(cookies.pcx_access, body);
    else if (op === "createClaim") result = await warrantyClaimService.createClaim(cookies.pcx_access, body);
    else if (op === "createClaimCustomer") result = await warrantyClaimService.createClaimForCustomer(cookies.pcx_access, body);
    else result = await warrantyClaimService.resolveClaim(cookies.pcx_access, body);
    send(response, op === "createWarranty" || op === "createClaim" ? 201 : 200, { data: result });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
