import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueInspectionTemplateItems,
  createInspectionTemplate,
  createInspectionTemplateItem,
  InspectionResultType,
  InspectionTemplateStatus
} from "../src/index.mjs";

test("inspection template is created ACTIVE with immutable versioning fields", () => {
  const template = createInspectionTemplate({ id: "t1", categoryId: "gpu", name: "GPU Inspection", version: "1.0", createdAt: "2026-08-16T00:00:00.000Z" });
  assert.equal(template.status, InspectionTemplateStatus.ACTIVE);
  assert.equal(template.categoryId, "gpu");
  assert.equal(template.version, "1.0");
  assert.throws(() => createInspectionTemplate({ id: "t", categoryId: "gpu", name: "N", version: "1", status: "DELETED" }), /status/);
});

test("inspection template item enforces canonical code and result type", () => {
  const item = createInspectionTemplateItem({ id: "i1", templateId: "t1", code: "power_on", label: "Power On", resultType: InspectionResultType.PASS_FAIL, isCritical: true, isMandatory: true });
  assert.equal(item.code, "power_on");
  assert.equal(item.isCritical, true);
  assert.throws(() => createInspectionTemplateItem({ id: "i", templateId: "t", code: "Bad Code", label: "x", resultType: "PASS_FAIL" }), /canonical/);
  assert.throws(() => createInspectionTemplateItem({ id: "i", templateId: "t", code: "x", label: "x", resultType: "UNKNOWN" }), /resultType/);
  assert.throws(() => createInspectionTemplateItem({ id: "i", templateId: "t", code: "x", label: "x", resultType: InspectionResultType.TEXT, isCritical: true }), /critical/);
});

test("inspection template items must be unique by code", () => {
  const items = [
    createInspectionTemplateItem({ id: "i1", templateId: "t", code: "power_on", label: "Power", resultType: InspectionResultType.PASS_FAIL }),
    createInspectionTemplateItem({ id: "i2", templateId: "t", code: "screen", label: "Screen", resultType: InspectionResultType.NUMBER })
  ];
  assert.equal(assertUniqueInspectionTemplateItems(items).length, 2);
  assert.throws(() => assertUniqueInspectionTemplateItems([...items, createInspectionTemplateItem({ id: "i3", templateId: "t", code: "power_on", label: "Dup", resultType: InspectionResultType.BOOLEAN })]), /duplicate/);
  assert.throws(() => assertUniqueInspectionTemplateItems([]), /at least one/);
});
