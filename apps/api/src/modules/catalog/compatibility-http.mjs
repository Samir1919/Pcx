import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { CompatibilityError } from "./compatibility-service.mjs";

function send(r, s, b) { r.writeHead(s).end(b == null ? undefined : JSON.stringify(b)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }
function cookies(req) {
  const out = {};
  for (const part of (req.headers?.cookie ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) try { out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* skip malformed */ }
  }
  return out;
}
function security(req, origins, parsed) {
  if (typeof req.headers?.origin !== "string" || !origins?.has(req.headers.origin)) throw new CompatibilityError("origin_denied");
  const header = req.headers?.["x-csrf-token"], value = parsed.pcx_csrf;
  if (typeof header !== "string" || typeof value !== "string" || header.length > 256) throw new CompatibilityError("csrf_invalid");
  const left = Buffer.from(header), right = Buffer.from(value);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new CompatibilityError("csrf_invalid");
}
async function body(req) {
  if (req.headers?.["content-type"]?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new CompatibilityError("invalid_request");
  const chunks = []; let size = 0;
  for await (const chunk of req) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.length; if (size > 16384) throw new CompatibilityError("invalid_request"); chunks.push(bytes); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw new CompatibilityError("invalid_request"); }
}
function id(value) { try { const v = decodeURIComponent(value); return v && v.length <= 128 && !v.includes("/") ? v : null; } catch { return null; } }
function mapped(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401, "UNAUTHENTICATED", "Authentication required"];
  if (!(error instanceof CompatibilityError)) return [500, "INTERNAL_ERROR", "Unexpected server error"];
  return ({ forbidden: [403, "FORBIDDEN", "Operation is not allowed"], origin_denied: [403, "ORIGIN_DENIED", "Request origin is not allowed"], csrf_invalid: [403, "CSRF_INVALID", "CSRF validation failed"], not_found: [404, "COMPATIBILITY_NOT_FOUND", "Compatibility record not found"], conflict: [409, "COMPATIBILITY_CONFLICT", "Record conflicts with existing data"], invalid_reference: [422, "INVALID_REFERENCE", "Catalog reference is invalid"], invalid_request: [400, "INVALID_REQUEST", "Request is invalid"], invalid_input: [422, "INVALID_INPUT", "Values are invalid"] })[error.code] ?? [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleCompatibilityRequest(req, res, { compatibilityService, allowedOrigins, requestId }) {
  const u = new URL(req.url, "http://pcx.local");
  let operation = null, args = [], m;
  if (u.pathname === "/api/v1/reference-values" && req.method === "GET") operation = "listReferenceValues";
  else if (u.pathname === "/api/v1/compatibility-rules" && req.method === "GET") operation = "listRules";
  else if (u.pathname === "/api/v1/admin/reference-values" && req.method === "POST") operation = "createReferenceValue";
  else if ((m = u.pathname.match(/^\/api\/v1\/admin\/reference-values\/([^/]+)$/)) && req.method === "DELETE") { operation = "archiveReferenceValue"; args = [id(m[1])]; }
  else if (u.pathname === "/api/v1/admin/compatibility-rules" && req.method === "POST") operation = "createRule";
  else if ((m = u.pathname.match(/^\/api\/v1\/admin\/compatibility-rules\/([^/]+)$/)) && req.method === "DELETE") { operation = "archiveRule"; args = [id(m[1])]; }
  else return false;

  if (!compatibilityService) { send(res, 503, failure("CATALOG_ADMIN_UNAVAILABLE", "Catalog administration is temporarily unavailable", requestId)); return true; }
  if (args.some((v) => !v)) { send(res, 400, failure("INVALID_REQUEST", "Request is invalid", requestId)); return true; }
  if (u.searchParams.size > 0) { send(res, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }

  const parsed = cookies(req);
  const readOnly = operation === "listReferenceValues" || operation === "listRules";
  try {
    if (!readOnly) security(req, allowedOrigins, parsed);
    const context = { requestId };
    let result;
    if (operation === "listReferenceValues") result = await compatibilityService.listReferenceValues();
    else if (operation === "listRules") result = await compatibilityService.listRules();
    else if (operation === "createReferenceValue") result = await compatibilityService.createReferenceValue(parsed.pcx_access, await body(req), context);
    else if (operation === "createRule") result = await compatibilityService.createRule(parsed.pcx_access, await body(req), context);
    else { await compatibilityService[operation](parsed.pcx_access, ...args, context); result = null; }
    send(res, operation === "createReferenceValue" || operation === "createRule" ? 201 : readOnly ? 200 : 204, readOnly ? result : result ? { data: result } : undefined);
  } catch (error) {
    const [status, code, message] = mapped(error);
    send(res, status, failure(code, message, requestId));
  }
  return true;
}
