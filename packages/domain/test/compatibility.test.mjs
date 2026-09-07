import assert from "node:assert/strict";
import test from "node:test";
import { CompatibilityOperator, createCompatibilityRule, createReferenceValue, evaluateCompatibility } from "../src/index.mjs";

const createdAt = "2026-08-16T04:00:00.000Z";

test("reference values validate canonical key and non-empty value", () => {
  const rv = createReferenceValue({ id: "rv-1", key: "socket", value: "AM4", label: "AM4", createdAt });
  assert.equal(rv.key, "socket");
  assert.equal(rv.value, "AM4");
  assert.equal(Object.isFrozen(rv), true);
  assert.throws(() => createReferenceValue({ id: "rv-2", key: "Bad Key", value: "AM4", label: "AM4" }), /snake_case/);
  assert.throws(() => createReferenceValue({ id: "rv-3", key: "socket", value: "", label: "AM4" }), /value/);
});

test("compatibility rules validate operator and keys", () => {
  const rule = createCompatibilityRule({ id: "r-1", sourceCategoryId: "cpu", sourceKey: "socket", operator: CompatibilityOperator.EQUALS, targetCategoryId: "motherboard", targetKey: "socket", reason: "CPU socket must match", createdAt });
  assert.equal(rule.operator, "EQUALS");
  assert.throws(() => createCompatibilityRule({ id: "r-2", sourceCategoryId: "cpu", sourceKey: "socket", operator: "BOGUS", targetCategoryId: "mb", targetKey: "socket", reason: "x" }), /unsupported/);
});

test("evaluateCompatibility flags mismatched socket and ignores absent components", () => {
  const rules = [
    createCompatibilityRule({ id: "r-1", sourceCategoryId: "cpu", sourceKey: "socket", operator: "EQUALS", targetCategoryId: "motherboard", targetKey: "socket", reason: "CPU socket must match the motherboard socket", createdAt }),
    createCompatibilityRule({ id: "r-2", sourceCategoryId: "motherboard", sourceKey: "memory_type", operator: "EQUALS", targetCategoryId: "ram", targetKey: "memory_type", reason: "Memory type must match", createdAt })
  ];
  const compatible = [{ categoryId: "cpu", specs: { socket: "AM4" } }, { categoryId: "motherboard", specs: { socket: "AM4", memory_type: "DDR4" } }, { categoryId: "ram", specs: { memory_type: "DDR4" } }];
  assert.deepEqual(evaluateCompatibility(rules, compatible), []);

  const incompatible = [{ categoryId: "cpu", specs: { socket: "LGA1700" } }, { categoryId: "motherboard", specs: { socket: "AM4" } }];
  const violations = evaluateCompatibility(rules, incompatible);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].sourceValue, "LGA1700");
  assert.equal(violations[0].targetValue, "AM4");
  assert.equal(violations[0].required, true);

  // Rule with no target component present is skipped (not a violation).
  assert.deepEqual(evaluateCompatibility(rules, [{ categoryId: "cpu", specs: { socket: "AM4" } }]), []);
});
