"use client";

// Human-readable labels for the server-owned sell-request lifecycle.
// Kept in sync with SellRequestStatus in @pcx/domain.
export const SELL_REQUEST_STATUS_LABELS = Object.freeze({
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  REVIEWING: "Reviewing",
  INFO_REQUIRED: "Info required",
  INSPECTION_REQUIRED: "Inspection required",
  INSPECTING: "Inspecting",
  OFFERED: "Offer sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  REJECTED_BY_SELLER: "Seller declined",
  EXPIRED: "Expired",
  ACQUISITION_PENDING: "Acquisition pending",
  PAID: "Paid",
  CLOSED: "Closed",
  CANCELLED: "Cancelled"
});

export function sellRequestStatusLabel(status) {
  return SELL_REQUEST_STATUS_LABELS[status] ?? status;
}

// Mainline progression for the admin status stepper.
export const SELL_REQUEST_FLOW = Object.freeze([
  "SUBMITTED",
  "REVIEWING",
  "INSPECTING",
  "OFFERED",
  "ACCEPTED",
  "ACQUISITION_PENDING",
  "PAID",
  "CLOSED"
]);
