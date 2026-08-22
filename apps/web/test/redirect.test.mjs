import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "../lib/redirect.js";

test("safeReturnPath accepts same-origin paths", () => {
  assert.equal(safeReturnPath("/sell?step=request&entry=DESKTOP_PC"), "/sell?step=request&entry=DESKTOP_PC");
  assert.equal(safeReturnPath("/storefront"), "/storefront");
  assert.equal(safeReturnPath("/"), "/");
});

test("safeReturnPath rejects protocol-relative and absolute URLs", () => {
  assert.equal(safeReturnPath("//evil.example"), "/storefront");
  assert.equal(safeReturnPath("https://evil.example"), "/storefront");
  assert.equal(safeReturnPath("javascript:alert(1)"), "/storefront");
  assert.equal(safeReturnPath("  //evil.example  "), "/storefront");
});

test("safeReturnPath falls back for missing, blank, or non-path values", () => {
  assert.equal(safeReturnPath(null), "/storefront");
  assert.equal(safeReturnPath(undefined), "/storefront");
  assert.equal(safeReturnPath(""), "/storefront");
  assert.equal(safeReturnPath("   "), "/storefront");
  assert.equal(safeReturnPath("storefront"), "/storefront");
});
