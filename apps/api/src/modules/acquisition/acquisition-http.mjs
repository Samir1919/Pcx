import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { AcquisitionError } from "./acquisition-service.mjs";

const maxBodyBytes = 32 * 1024;

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
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new AcquisitionError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new AcquisitionError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new AcquisitionError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new AcquisitionError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new AcquisitionError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new AcquisitionError("invalid_request"); }
}

function id(value) {
  try { const decoded = decodeURIComponent(value); return decoded && decoded.length <= 128 && !decoded.includes("/") ? decoded : null; } catch { return null; }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof AcquisitionError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "ACQUISITION_FORBIDDEN", "Acquisition operation is not allowed"];
    if (error.code === "conflict") return [409, "ACQUISITION_CONFLICT", "Acquisition conflicts with existing data"];
    if (error.code === "invalid_state") return [409, "INVALID_OFFER_STATE", "Offer is not in an acceptable state"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Acquisition reference is invalid"];
    if (error.code === "not_found") return [404, "ACQUISITION_NOT_FOUND", "Acquisition resource not found"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Acquisition request is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

function match(url) {
  const patterns = [
    [/^\/api\/v1\/admin\/valuations$/, "createValuation"],
    [/^\/api\/v1\/admin\/offers$/, "createOffer"],
    [/^\/api\/v1\/admin\/offers\/([^/]+)\/accept$/, "acceptOffer"],
    [/^\/api\/v1\/offers\/([^/]+)\/accept$/, "acceptOfferCustomer"],
    [/^\/api\/v1\/offers\/([^/]+)\/reject$/, "rejectOfferCustomer"],
    [/^\/api\/v1\/admin\/acquisitions$/, "createAcquisition"],
    [/^\/api\/v1\/admin\/acquisitions\/([^/]+)\/pay$/, "markAcquisitionPaid"]
  ];
  for (const [re, op] of patterns) {
    const m = url.pathname.match(re);
    if (m) return { op, id: m[1] ?? null };
  }
  return null;
}

export async function handleAcquisitionRequest(request, response, { acquisitionService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  const route = match(url);
  if (!route) return false;
  if (!acquisitionService) { send(response, 503, failure("ACQUISITION_UNAVAILABLE", "Acquisition is temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
  if (request.method !== "POST") {
    send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
    return true;
  }

  const cookies = parsedCookies(request);
  try {
    requireWriteSecurity(request, allowedOrigins, cookies);
    const body = route.id ? {} : await jsonBody(request);
    let result;
    if (route.op === "createValuation") result = await acquisitionService.createValuation(cookies.pcx_access, body);
    else if (route.op === "createOffer") result = await acquisitionService.createOffer(cookies.pcx_access, body);
    else if (route.op === "acceptOffer") result = await acquisitionService.acceptOffer(cookies.pcx_access, id(route.id));
    else if (route.op === "acceptOfferCustomer") result = await acquisitionService.acceptOfferForCustomer(cookies.pcx_access, id(route.id));
    else if (route.op === "rejectOfferCustomer") result = await acquisitionService.rejectOfferForCustomer(cookies.pcx_access, id(route.id));
    else if (route.op === "markAcquisitionPaid") result = await acquisitionService.markAcquisitionPaid(cookies.pcx_access, id(route.id));
    else result = await acquisitionService.createAcquisition(cookies.pcx_access, body);
    send(response, 201, { data: result });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
