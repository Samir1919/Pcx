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
export { advanceSellRequest, assertSellRequestTransition, createSellRequest, createSellerDeclaration, FulfilmentPreference, parseSellRequestStatus, SellRequestStatus, SellRequestTransitions, submitSellRequest } from "./acquisition/sell-request.mjs";
export { BuildComponentRole, createBuildComponent, parseSellEntry, SellEntry, validateBuildComponents } from "./acquisition/sell-entry.mjs";
export { createSellBuildComponent, createSellEntryConfig, parseBuildComponentRole, parseSellEntryIcon, parseSellEntryKey, parseSellEntryKind, SellEntryIcon, SellEntryKind } from "./acquisition/sell-taxonomy.mjs";
export { acceptOffer, AcquisitionPaymentStatus, AcquisitionSourceType, createAcquisition, createOffer, markAcquisitionPaid, OfferStatus, rejectOffer } from "./acquisition/valuation-offer.mjs";
export { assertPrimarySerialIdentifier, createInventoryItem, createSerialIdentifier, generatePcxItemId, InventoryItemStatus, normalizeSerialIdentifier, SerialIdentifierType } from "./inventory/inventory-item.mjs";
export { assertUniqueInspectionTemplateItems, createInspectionTemplate, createInspectionTemplateItem, InspectionResultType, InspectionTemplateStatus } from "./inspection/inspection-template.mjs";
export { approveInspection, computeHealthScore, ConditionGrade, createInspection, createTestResult, InspectionStatus, rejectInspection, submitInspection, suggestGrade, TestResultStatus } from "./inspection/inspection-execution.mjs";
export { createListing, createListingPrice, createPublicListing, createPublicPassport, ListingStatus, publishListing } from "./listing/listing.mjs";
export { convertReservation, createReservation, isExpiredReservation, ReservationStatus } from "./commerce/reservation.mjs";
export { CartStatus, createCart, createCartItem } from "./commerce/cart.mjs";
export { confirmPayment, createOrder, createOrderItemSnapshot, createPayment, OrderStatus, PaymentDirection, PaymentMethod, PaymentStatus } from "./commerce/order-payment.mjs";
export { createNotification, markNotificationFailed, markNotificationSent, NotificationChannel, NotificationStatus } from "./notification/notification.mjs";
export { createShipment, createShipmentEvent, markDelivered, markReturned, markShipped, ShipmentStatus } from "./logistics/shipment.mjs";
export { createPaymentProviderConfig, maskCredentials, normalizeCredentials, PaymentProvider, PaymentProviderMode } from "./payment/payment-provider-config.mjs";

export { approveReturn, createReturnRequest, markReturnReceived, ReturnRequestStatus, settleRefund } from "./warranty/return-refund.mjs";
export { createClaim, createClaimResolution, createWarranty, ClaimStatus, ResolutionType, WarrantyStatus } from "./warranty/warranty-claim.mjs";
export { archiveIndicativePrice, createIndicativePrice, IndicativePriceStatus, toPublicQuoteRange } from "./pricing/indicative-price.mjs";
export { createBkashGateway, createSandboxCourier, createSandboxNotificationDispatcher, createSandboxPaymentGateway } from "./vendor/vendor-adapters.mjs";
