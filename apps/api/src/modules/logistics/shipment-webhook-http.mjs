import { ShipmentError } from "./shipment-service.mjs";

const maxBodyBytes = 16 * 1024;

function send(response, status, body) { response.writeHead(status).end(body == null ? undefined : JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }

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

function map(error) {
  if (error instanceof ShipmentError) {
    if (error.code === "unauthorized") return [401, "UNAUTHORIZED", "Webhook signature is invalid"];
    if (error.code === "invalid_request") return [400, "INVALID_REQUEST", "Webhook request is invalid"];
    if (error.code === "invalid_input") return [422, "INVALID_INPUT", "Webhook payload is invalid"];
    if (error.code === "invalid_state") return [409, "INVALID_SHIPMENT_STATE", "Shipment is not in an acceptable state"];
    return [422, "INVALID_INPUT", "Webhook payload is invalid"];
  }
  return [500, "INTERNAL_ERROR", "Unexpected server error"];
}

export async function handleCourierWebhookRequest(request, response, { shipmentService, requestId }) {
  const url = new URL(request.url, "http://pcx.local");
  if (url.pathname !== "/api/v1/webhooks/courier") return false;
  if (!shipmentService) { send(response, 503, failure("SHIPMENT_UNAVAILABLE", "Shipments are temporarily unavailable", requestId)); return true; }
  if (url.searchParams.size > 0) { send(response, 400, failure("INVALID_REQUEST", "Query parameters are not supported", requestId)); return true; }
  if ((request.method ?? "GET") !== "POST") { send(response, 405, failure("METHOD_NOT_ALLOWED", "Method not allowed", requestId)); return true; }

  try {
    const body = await jsonBody(request);
    if (typeof body.shipmentId !== "string" || body.shipmentId.length === 0) throw new ShipmentError("invalid_input");
    if (typeof body.providerStatus !== "string" || body.providerStatus.length === 0) throw new ShipmentError("invalid_input");
    const signature = request.headers?.["x-courier-signature"];
    const result = await shipmentService.handleWebhook({
      signature,
      shipmentId: body.shipmentId,
      providerStatus: body.providerStatus,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined
    });
    send(response, 200, { data: result });
  } catch (error) {
    const [status, code, message] = map(error);
    send(response, status, failure(code, message, requestId));
  }
  return true;
}
