import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { IndicativePriceError } from "./indicative-price-service.mjs";

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
    try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore */ }
  }
  return result;
}

function requireWriteSecurity(request, allowedOrigins, cookies) {
  const origin = request.headers?.origin;
  if (typeof origin !== "string" || !allowedOrigins?.has(origin)) throw new IndicativePriceError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = cookies.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new IndicativePriceError("csrf_invalid");
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new IndicativePriceError("csrf_invalid");
}

async function jsonBody(request) {
  if (typeof request.headers?.["content-type"] !== "string" || request.headers["content-type"].split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new IndicativePriceError("invalid_request");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBodyBytes) throw new IndicativePriceError("invalid_request");
    chunks.push(bytes);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new IndicativePriceError("invalid_request"); }
}

function map(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (error instanceof IndicativePriceError) {
    if (error.code === "origin_denied") return [403, "ORIGIN_DENIED", "Request origin is not allowed"];
    if (error.code === "csrf_invalid") return [403, "CSRF_INVALID", "CSRF validation failed"];
    if (error.code === "forbidden") return [403, "FORBIDDEN", "Pricing operation is not allowed"];
    if (error.code === "invalid_reference") return [422, "INVALID_REFERENCE", "Pricing reference is invalid"];
    if (error.code === "conflict") return [409, "PRICE_CONFLICT", "Indicative price conflicts with existing data"];
    return [error.code === "invalid_request" ? 400 : 422, error.code === "invalid_request" ? "INVALID_REQUEST" : "INVALID_INPUT", "Indicative price is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleIndicativePriceRequest(request, response, { indicativePriceService, allowedOrigins, requestId }) {
  const url = new URL(request.url, "http://pcx.local");

  // Admin writes + history: /api/v1/admin/indicative-prices
  if (url.pathname === "/api/v1/admin/indicative-prices") {
    if (!indicativePriceService) { send(response, 503, failure("PRICING_UNAVAILABLE", "Indicative pricing is temporarily unavailable", requestId)); return true; }
    if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
    const cookies = parsedCookies(request);
    if (request.method === "POST") {
      try {
        requireWriteSecurity(request, allowedOrigins, cookies);
        send(response, 201, { data: await indicativePriceService.set(cookies.pcx_access, await jsonBody(request)) });
      } catch (error) {
        const [status, code, message] = map(error);
        send(response, status, failure(code, message, requestId));
      }
      return true;
    }
    if (request.method === "GET") {
      try {
        send(response, 200, await indicativePriceService.listAdmin(cookies.pcx_access));
      } catch (error) {
        const [status, code, message] = map(error);
        send(response, status, failure(code, message, requestId));
      }
      return true;
    }
    send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
    return true;
  }

  // Public quote range (read-only): /api/v1/quote-ranges?productModelId=&categoryId=
  if (url.pathname === "/api/v1/quote-ranges") {
    if (!indicativePriceService) { send(response, 503, failure("PRICING_UNAVAILABLE", "Indicative pricing is temporarily unavailable", requestId)); return true; }
    if (request.method !== "GET") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }
    for (const key of url.searchParams.keys()) if (!new Set(["productModelId", "categoryId"]).has(key)) { send(response, 400, failure("INVALID_REQUEST", "Query parameter is not supported", requestId)); return true; }
    const productModelId = url.searchParams.get("productModelId");
    const categoryId = url.searchParams.get("categoryId");
    if (!productModelId && !categoryId) { send(response, 400, failure("INVALID_REQUEST", "productModelId or categoryId is required", requestId)); return true; }
    try {
      send(response, 200, await indicativePriceService.quote({ productModelId, categoryId }));
    } catch (error) {
      const [status, code, message] = map(error);
      send(response, status, failure(code, message, requestId));
    }
    return true;
  }

  return false;
}
