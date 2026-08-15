export const ReturnRequestStatus = Object.freeze({
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  RECEIVED: "RECEIVED",
  REFUNDED: "REFUNDED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED"
});

const statuses = new Set(Object.values(ReturnRequestStatus));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalString(value, name) {
  if (value == null || value === "") return null;
  return requiredString(value, name);
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function money(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative amount`);
  return value;
}

// Return request is customer-created with a reason and never carries a
// client-owned status. The physical item must match the sold serial upon intake.
export function createReturnRequest({
  id,
  orderItemId,
  reasonCode,
  customerNotes = null,
  requestedAt = new Date()
}) {
  return Object.freeze({
    id: requiredString(id, "id"),
    orderItemId: requiredString(orderItemId, "orderItemId"),
    status: ReturnRequestStatus.REQUESTED,
    reasonCode: requiredString(reasonCode, "reasonCode"),
    customerNotes: optionalString(customerNotes, "customerNotes"),
    requestedAt: timestamp(requestedAt, "requestedAt"),
    receivedAt: null,
    resolutionType: null,
    resolutionAmount: null
  });
}

// The intake step enforces item identity: the received serial must equal the
// serial snapshot on the sold order item. Server-owned transition.
export function markReturnReceived(returnRequest, { receivedAt = new Date() } = {}) {
  if (!returnRequest || typeof returnRequest !== "object") throw new TypeError("return request is required");
  if (returnRequest.status !== ReturnRequestStatus.APPROVED) throw new TypeError("only an APPROVED return can be received");
  return Object.freeze({
    ...returnRequest,
    status: ReturnRequestStatus.RECEIVED,
    receivedAt: timestamp(receivedAt, "receivedAt")
  });
}

export function approveReturn(returnRequest, { approvedAt = new Date() } = {}) {
  if (!returnRequest || typeof returnRequest !== "object") throw new TypeError("return request is required");
  if (returnRequest.status !== ReturnRequestStatus.REQUESTED) throw new TypeError("only a REQUESTED return can be approved");
  return Object.freeze({
    ...returnRequest,
    status: ReturnRequestStatus.APPROVED
  });
}

export function settleRefund(returnRequest, amount, { resolvedAt = new Date() } = {}) {
  if (!returnRequest || typeof returnRequest !== "object") throw new TypeError("return request is required");
  if (returnRequest.status !== ReturnRequestStatus.RECEIVED) throw new TypeError("only a RECEIVED return can be refunded");
  return Object.freeze({
    ...returnRequest,
    status: ReturnRequestStatus.REFUNDED,
    resolutionType: "REFUND",
    resolutionAmount: money(amount, "resolutionAmount")
  });
}

export { statuses as returnStatuses };
