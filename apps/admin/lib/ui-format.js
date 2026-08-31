"use client";

// Shared admin UI formatting: server-owned status/grade codes get human
// labels + tone hints; prices and dates are rendered consistently.

const INVENTORY_STATUS = {
  RECEIVED: { label: "Received", tone: "info" },
  INSPECTION: { label: "Inspection", tone: "warn" },
  APPROVED: { label: "Approved", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "bad" },
  ESCALATED: { label: "Escalated", tone: "warn" }
};

const LISTING_STATUS = {
  DRAFT: { label: "Draft", tone: "muted" },
  PUBLISHED: { label: "Published", tone: "ok" },
  RESERVED: { label: "Reserved", tone: "warn" },
  PAUSED: { label: "Paused", tone: "muted" }
};

const GRADES = {
  A_PLUS: { label: "A+", tone: "ok" },
  A: { label: "A", tone: "ok" },
  B: { label: "B", tone: "warn" },
  C: { label: "C", tone: "warn" },
  REJECT: { label: "Reject", tone: "bad" }
};

function pick(table, code, fallback) {
  return table[code] ?? fallback ?? { label: code ?? "—", tone: "muted" };
}

export function statusLabel(status, kind = "inventory") {
  return pick(kind === "listing" ? LISTING_STATUS : INVENTORY_STATUS, status).label;
}

export function statusTone(status, kind = "inventory") {
  return pick(kind === "listing" ? LISTING_STATUS : INVENTORY_STATUS, status).tone;
}

export function gradeLabel(grade) {
  return grade ? (GRADES[grade]?.label ?? grade) : "—";
}

export function gradeTone(grade) {
  return grade ? (GRADES[grade]?.tone ?? "muted") : "muted";
}

export function formatPrice(price) {
  if (price == null || price === "") return "—";
  return `৳${Number(price).toLocaleString("en-BD")}`;
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
