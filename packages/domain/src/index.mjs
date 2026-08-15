export const domainInvariants = Object.freeze({
  uniquePhysicalLifecycle: true,
  productModelSeparateFromInventoryItem: true,
  serverAuthoritativeState: true,
  idempotentFinancialOperations: true,
  maskedPublicPassport: true
});

export { Permission, Role, UserStatus } from "./identity/constants.mjs";
export { authorize, authorizeRoleAssignment, hasPermission, permissionsForRole } from "./identity/role-policy.mjs";
export { createSecurityAuditEvent } from "./identity/audit-event.mjs";
export { createCustomerRegistrationCandidate, createOwnAddress } from "./identity/identity-record.mjs";
export { archiveCatalogRecord, CatalogStatus, createBrand, createCategory, createProductModel } from "./catalog/catalog-records.mjs";
export { assertUniqueModelSpecificationValues, createModelSpecificationValue, createSpecificationDefinition, SpecificationDataType } from "./catalog/specifications.mjs";
export { createSellRequest, createSellerDeclaration, FulfilmentPreference, parseSellRequestStatus, SellRequestStatus, submitSellRequest } from "./acquisition/sell-request.mjs";
export { assertPrimarySerialIdentifier, createInventoryItem, createSerialIdentifier, InventoryItemStatus, normalizeSerialIdentifier, SerialIdentifierType } from "./inventory/inventory-item.mjs";
export { assertUniqueInspectionTemplateItems, createInspectionTemplate, createInspectionTemplateItem, InspectionResultType, InspectionTemplateStatus } from "./inspection/inspection-template.mjs";
