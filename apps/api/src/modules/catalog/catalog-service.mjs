import { CatalogStatus } from "../../../../../packages/domain/src/index.mjs";
import { toPublicBrand, toPublicCategory, toPublicProductModel, toPublicSpecification } from "./catalog-dto.mjs";

const requiredMethods = ["listCategories", "listBrands", "listProductModels", "findProductModelById"];

function assertRepository(repository) {
  if (!repository || requiredMethods.some((method) => typeof repository[method] !== "function")) {
    throw new TypeError("catalog repository does not implement the required port");
  }
}

function active(records) {
  if (!Array.isArray(records)) throw new TypeError("catalog repository list result must be an array");
  return records.filter((record) => record?.status === CatalogStatus.ACTIVE);
}

function listResult(result, mapper) {
  const records = Array.isArray(result) ? result : result?.records;
  const nextCursor = Array.isArray(result) ? null : result?.nextCursor ?? null;
  return Object.freeze({ data: Object.freeze(active(records).map(mapper)), meta: Object.freeze({ nextCursor }) });
}

export function createCatalogService({ repository }) {
  assertRepository(repository);
  return Object.freeze({
    async listCategories() {
      return listResult(await repository.listCategories(), toPublicCategory);
    },
    async listBrands() {
      return listResult(await repository.listBrands(), toPublicBrand);
    },
    async listProductModels(filters) {
      return listResult(await repository.listProductModels(filters), toPublicProductModel);
    },
    async getProductModel(id) {
      const record = await repository.findProductModelById(id);
      if (record?.status !== CatalogStatus.ACTIVE) return null;
      const specifications = typeof repository.listModelSpecifications === "function"
        ? await repository.listModelSpecifications(id)
        : [];
      if (!Array.isArray(specifications)) throw new TypeError("catalog repository specification result must be an array");
      return Object.freeze({
        ...toPublicProductModel(record),
        specifications: Object.freeze(specifications.map(toPublicSpecification))
      });
    }
  });
}
