import test from "node:test";
import assert from "node:assert/strict";
import { sellRequestStatusLabel, SELL_REQUEST_FLOW } from "../lib/sell-request-status.js";

test("sellRequestStatusLabel maps raw statuses to human-readable labels", () => {
  assert.equal(sellRequestStatusLabel("OFFERED"), "Offer sent");
  assert.equal(sellRequestStatusLabel("ACQUISITION_PENDING"), "Acquisition pending");
  assert.equal(sellRequestStatusLabel("REJECTED_BY_SELLER"), "Seller declined");
  assert.equal(sellRequestStatusLabel("UNKNOWN"), "UNKNOWN");
});

test("SELL_REQUEST_FLOW is the mainline progression", () => {
  assert.ok(SELL_REQUEST_FLOW.includes("OFFERED"));
  assert.ok(SELL_REQUEST_FLOW.includes("PAID"));
  assert.ok(SELL_REQUEST_FLOW.indexOf("ACCEPTED") > SELL_REQUEST_FLOW.indexOf("OFFERED"));
});
