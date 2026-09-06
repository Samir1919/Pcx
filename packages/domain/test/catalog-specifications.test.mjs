import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveCatalogRecord,
  assertRequiredSpecificationValues,
  assertUniqueModelSpecificationValues,
  attributeGroupLabel,
  createAttributeSet,
  createAttributeSetItem,
  createModelSpecificationValue,
  createProductModel,
  createSpecificationDefinition,
  SpecificationDataType
} from "../src/index.mjs";

const createdAt = "2026-08-16T04:00:00.000Z";
const model = createProductModel({ id: "model-1", categoryId: "gpu", brandId: "brand-1", name: "GPU 1", slug: "gpu-1", createdAt });
const definition = (overrides = {}) => createSpecificationDefinition({
  id: "spec-vram",
  key: "vram_gb",
  label: "VRAM",
  dataType: SpecificationDataType.NUMBER,
  unit: "GB",
  filterable: true,
  createdAt,
  ...overrides
});

test("specification definitions validate canonical schema metadata", () => {
  const spec = definition();
  assert.equal(spec.key, "vram_gb");
  assert.equal(spec.unit, "GB");
  assert.equal(spec.filterable, true);
  assert.equal(Object.isFrozen(spec), true);
  assert.throws(() => definition({ key: "VRAM GB" }), /snake_case/);
  assert.throws(() => definition({ dataType: "INTEGER" }), /unsupported/);
  assert.throws(() => definition({ dataType: SpecificationDataType.JSON, filterable: true }), /cannot be filterable/);
});

test("model specification values enforce type and active status", () => {
  const numberValue = createModelSpecificationValue({ id: "value-1", productModel: model, definition: definition(), value: 12, createdAt });
  assert.equal(numberValue.value, 12);
  assert.throws(() => createModelSpecificationValue({ id: "value-2", productModel: model, definition: definition(), value: "12" }), /finite number/);
  const archived = archiveCatalogRecord(definition(), { archivedAt: "2026-08-16T05:00:00.000Z" });
  assert.throws(() => createModelSpecificationValue({ id: "value-4", productModel: model, definition: archived, value: 12 }), /must be active/);
});

test("attribute sets and set items carry per-assignment required and sort order", () => {
  const set = createAttributeSet({ id: "set-1", key: "gpu", label: "GPU", createdAt });
  assert.equal(set.key, "gpu");
  assert.equal(Object.isFrozen(set), true);
  assert.throws(() => createAttributeSet({ id: "set-2", key: "Bad Key", label: "GPU" }), /slug/);
  const item = createAttributeSetItem({ setId: "set-1", definitionId: "spec-vram", required: true, sortOrder: 3 });
  assert.equal(item.required, true);
  assert.equal(item.sortOrder, 3);
  assert.throws(() => createAttributeSetItem({ setId: "set-1", definitionId: "spec-vram", required: "yes" }), /boolean/);
  assert.throws(() => createAttributeSetItem({ setId: "set-1", definitionId: "spec-vram", sortOrder: -1 }), /non-negative/);
  assert.throws(() => createAttributeSetItem({ setId: "set-1", definitionId: "spec-vram", groupKey: "Bad Group" }), /slug/);
  const grouped = createAttributeSetItem({ setId: "set-1", definitionId: "spec-vram", groupKey: "ram" });
  assert.equal(grouped.groupKey, "ram");
  assert.equal(createAttributeSetItem({ setId: "set-1", definitionId: "spec-vram" }).groupKey, null);
  assert.equal(attributeGroupLabel("ram"), "RAM");
  assert.equal(attributeGroupLabel("system_wattage"), "System Wattage");
  assert.equal(attributeGroupLabel(null), null);
});

test("all supported scalar types are strict", () => {
  const text = createModelSpecificationValue({ id: "text-1", productModel: model, definition: definition({ id: "text", key: "chipset", dataType: SpecificationDataType.TEXT, unit: null }), value: " Ada ", createdAt });
  const boolean = createModelSpecificationValue({ id: "bool-1", productModel: model, definition: definition({ id: "bool", key: "ray_tracing", dataType: SpecificationDataType.BOOLEAN, unit: null }), value: false, createdAt });
  assert.equal(text.value, "Ada");
  assert.equal(boolean.value, false);
  assert.throws(() => createModelSpecificationValue({ id: "bool-2", productModel: model, definition: definition({ id: "bool", key: "ray_tracing", dataType: SpecificationDataType.BOOLEAN }), value: 0 }), /boolean/);
});

test("JSON specification values are cloned, deeply frozen, and serializable", () => {
  const source = { ports: ["HDMI", "DisplayPort"], metadata: { lanes: 16 } };
  const json = createModelSpecificationValue({ id: "json-1", productModel: model, definition: definition({ id: "json", key: "port_layout", dataType: SpecificationDataType.JSON, unit: null, filterable: false }), value: source, createdAt });
  source.ports.push("USB-C");
  assert.deepEqual(json.value.ports, ["HDMI", "DisplayPort"]);
  assert.equal(Object.isFrozen(json.value), true);
  assert.equal(Object.isFrozen(json.value.ports), true);
  const circular = {};
  circular.self = circular;
  assert.throws(() => createModelSpecificationValue({ id: "json-2", productModel: model, definition: definition({ id: "json", key: "port_layout", dataType: SpecificationDataType.JSON, filterable: false }), value: circular }), /JSON-serializable/);
  assert.throws(() => createModelSpecificationValue({ id: "json-3", productModel: model, definition: definition({ id: "json", key: "port_layout", dataType: SpecificationDataType.JSON, filterable: false }), value: { omitted: undefined } }), /unsupported type/);
  const unsafe = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => createModelSpecificationValue({ id: "json-4", productModel: model, definition: definition({ id: "json", key: "port_layout", dataType: SpecificationDataType.JSON, filterable: false }), value: unsafe }), /unsafe key/);
});

test("model specification sets reject duplicate definitions and mixed models", () => {
  const value = createModelSpecificationValue({ id: "value-1", productModel: model, definition: definition(), value: 12, createdAt });
  assert.deepEqual(assertUniqueModelSpecificationValues([value]), [value]);
  assert.throws(() => assertUniqueModelSpecificationValues([value, { ...value, id: "value-2" }]), /duplicate/);
  assert.throws(() => assertUniqueModelSpecificationValues([value, { ...value, id: "value-3", productModelId: "model-2", specificationDefinitionId: "spec-other" }]), /one ProductModel/);
});

test("assertRequiredSpecificationValues enforces required completeness", () => {
  const req = { ...definition({ id: "req" }), required: true };
  const opt = { ...definition({ id: "opt", key: "chipset", dataType: SpecificationDataType.TEXT, unit: null, filterable: false }), required: false };
  const value = createModelSpecificationValue({ id: "v1", productModel: model, definition: req, value: 12, createdAt });
  // All required present -> pass.
  assert.deepEqual(assertRequiredSpecificationValues([value], [req, opt]), [value]);
  // Missing a required definition -> throw.
  assert.throws(() => assertRequiredSpecificationValues([], [req, opt]), /missing required/);
  assert.throws(() => assertRequiredSpecificationValues([], [req]), /vram_gb/);
});
