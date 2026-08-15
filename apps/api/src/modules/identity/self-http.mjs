import { AuthenticationError } from "./auth-service.mjs";

function accessCookie(request) {
  const header = request.headers?.cookie;
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1 || part.slice(0, index).trim() !== "pcx_access") continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
  }
  return null;
}

function send(response, status, body) { response.writeHead(status).end(JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }

export async function handleSelfRequest(request, response, { authService, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  if (url.pathname !== "/api/v1/me") return false;
  if (request.method !== "GET") {
    send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId));
    return true;
  }
  if (url.searchParams.size > 0) {
    send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId));
    return true;
  }
  if (!authService) {
    send(response, 503, failure("AUTH_UNAVAILABLE", "Authentication is temporarily unavailable", requestId));
    return true;
  }
  try {
    const identity = await authService.authenticateAccess({ accessCredential: accessCookie(request) });
    send(response, 200, { data: identity });
  } catch (error) {
    if (error instanceof AuthenticationError && error.code === "invalid_access") send(response, 401, failure("UNAUTHENTICATED", "Authentication required", requestId));
    else send(response, 500, failure("INTERNAL_ERROR", "Unexpected server error", requestId));
  }
  return true;
}
