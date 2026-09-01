import { apiRequest } from "./api-client.js";

// Backwards-compatible re-exports so existing callers/tests keep working; the
// old CatalogApiError and csrfToken now alias the shared api-client versions.
export { ApiError as CatalogApiError, csrfToken } from "./api-client.js";

export const catalogApi = Object.freeze({
  categories: () => apiRequest("/api/v1/categories"),
  brands: () => apiRequest("/api/v1/brands"),
  models: ({ cursor, categoryId } = {}) => apiRequest(`/api/v1/product-models?limit=50${categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : ""}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
  model: (id) => apiRequest(`/api/v1/product-models/${encodeURIComponent(id)}`),
  definitions: (categoryId) => apiRequest(`/api/v1/admin/attribute-definitions${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""}`),
  modelValues: (modelId) => apiRequest(`/api/v1/admin/product-models/${encodeURIComponent(modelId)}/specifications`),
  createCategory: (body) => apiRequest("/api/v1/admin/categories", { method: "POST", body }),
  createBrand: (body) => apiRequest("/api/v1/admin/brands", { method: "POST", body }),
  createModel: (body) => apiRequest("/api/v1/admin/product-models", { method: "POST", body }),
  createDefinition: (body) => apiRequest("/api/v1/admin/attribute-definitions", { method: "POST", body }),
  importCsv: (csv) => apiRequest("/api/v1/admin/catalog/import", { method: "POST", body: { csv } }),
  update: (resource, id, body) => apiRequest(`/api/v1/admin/${resource}/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  archive: (resource, id) => apiRequest(`/api/v1/admin/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  remove: (resource, id) => apiRequest(`/api/v1/admin/${resource}/${encodeURIComponent(id)}?purge=1`, { method: "DELETE" }),
  setModelValue: (modelId, definitionId, value) => apiRequest(`/api/v1/admin/product-models/${encodeURIComponent(modelId)}/specifications/${encodeURIComponent(definitionId)}`, { method: "PUT", body: { value } })
});
