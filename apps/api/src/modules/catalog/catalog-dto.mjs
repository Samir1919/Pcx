function publicBase(record) {
  return Object.freeze({ id: record.id, name: record.name, slug: record.slug });
}

export function toPublicCategory(record) {
  return Object.freeze({ ...publicBase(record), parentId: record.parentId ?? null, sortOrder: record.sortOrder });
}

export function toPublicBrand(record) {
  return publicBase(record);
}

export function toPublicProductModel(record) {
  return Object.freeze({
    ...publicBase(record),
    categoryId: record.categoryId,
    brandId: record.brandId,
    modelCode: record.modelCode ?? null,
    searchAliases: Object.freeze([...(record.searchAliases ?? [])])
  });
}

export function toPublicSpecification(record) {
  return Object.freeze({
    key: record.key,
    label: record.label,
    dataType: record.dataType,
    unit: record.unit ?? null,
    value: record.value
  });
}
