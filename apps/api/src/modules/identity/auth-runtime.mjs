import { createInMemoryAuthAbuseControl } from "./auth-abuse-control.mjs";
import { createAuthService } from "./auth-service.mjs";
import { createPostgresAuthAudit } from "./postgres-auth-audit.mjs";
import { createPostgresIdentityRepository } from "./postgres-identity-repository.mjs";
import { createUserAdminRepository } from "./user-admin-repository.mjs";
import { createUserAdminService } from "./user-admin-service.mjs";
import { createPostgresIdentityActionRepository } from "./postgres-identity-action-repository.mjs";
import { createIdentityActionService } from "./identity-action-service.mjs";
import { createDevContactVerifier } from "./dev-contact-verifier.mjs";
import { createPostgresAddressRepository } from "./postgres-address-repository.mjs";
import { createAddressService } from "./address-service.mjs";
import { createPostgresCatalogRepository } from "../catalog/postgres-catalog-repository.mjs";
import { createCatalogService } from "../catalog/catalog-service.mjs";
import { createPostgresCatalogCommandRepository } from "../catalog/postgres-catalog-command-repository.mjs";
import { createCatalogCommandService } from "../catalog/catalog-command-service.mjs";
import { createPostgresCatalogSpecCommandRepository } from "../catalog/postgres-catalog-spec-command-repository.mjs";
import { createCatalogSpecCommandService } from "../catalog/catalog-spec-command-service.mjs";
import { createPostgresSellRequestRepository } from "../acquisition/postgres-sell-request-repository.mjs";
import { createSellRequestService } from "../acquisition/sell-request-service.mjs";
import { createPostgresAcquisitionRepository } from "../acquisition/postgres-acquisition-repository.mjs";
import { createAcquisitionService } from "../acquisition/acquisition-service.mjs";
import { createPostgresInventoryRepository } from "../inventory/postgres-inventory-repository.mjs";
import { createInventoryService } from "../inventory/inventory-service.mjs";
import { createPostgresInspectionTemplateRepository } from "../inspection/postgres-inspection-template-repository.mjs";
import { createInspectionTemplateService } from "../inspection/inspection-template-service.mjs";
import { createPostgresListingRepository } from "../listing/postgres-listing-repository.mjs";
import { createListingService } from "../listing/listing-service.mjs";
import { createMerchantListingRepository } from "../listing/merchant-listing-repository.mjs";
import { createMerchantListingService } from "../listing/merchant-listing-service.mjs";
import { createPostgresReservationRepository } from "../commerce/postgres-reservation-repository.mjs";
import { createReservationService } from "../commerce/reservation-service.mjs";
import { createPostgresOrderPaymentRepository } from "../commerce/postgres-order-payment-repository.mjs";
import { createOrderPaymentService } from "../commerce/order-payment-service.mjs";
import { createPostgresShipmentRepository } from "../logistics/postgres-shipment-repository.mjs";
import { createShipmentService } from "../logistics/shipment-service.mjs";
import { createPostgresReturnRequestRepository } from "../warranty/postgres-return-request-repository.mjs";
import { createReturnRequestService } from "../warranty/return-request-service.mjs";
import { createPostgresWarrantyClaimRepository } from "../warranty/postgres-warranty-claim-repository.mjs";
import { createWarrantyClaimService } from "../warranty/warranty-claim-service.mjs";
import { createPostgresOperationsReportRepository } from "../reporting/postgres-operations-report-repository.mjs";
import { createOperationsReportService } from "../reporting/operations-report-service.mjs";
import { createPostgresNotificationRepository } from "../notification/postgres-notification-repository.mjs";
import { createNotificationService } from "../notification/notification-service.mjs";
import { createPostgresAuditLogRepository } from "../audit/postgres-audit-log-repository.mjs";
import { createAuditLogService } from "../audit/audit-log-service.mjs";
import { createPostgresPaymentProviderConfigRepository } from "../payment/postgres-payment-provider-config-repository.mjs";
import { createPaymentProviderConfigService } from "../payment/payment-provider-config-service.mjs";
import { createPostgresIndicativePriceRepository } from "../pricing/postgres-indicative-price-repository.mjs";
import { createIndicativePriceService } from "../pricing/indicative-price-service.mjs";
import { createPostgresSellTaxonomyRepository } from "../catalog/postgres-sell-taxonomy-repository.mjs";
import { createPostgresSellTaxonomyCommandRepository } from "../catalog/postgres-sell-taxonomy-command-repository.mjs";
import { createSellTaxonomyService } from "../catalog/sell-taxonomy-service.mjs";
import { createPostgresSiteFooterRepository } from "../footer/postgres-site-footer-repository.mjs";
import { createSiteFooterService } from "../footer/site-footer-service.mjs";

export function parseAllowedOrigins(value) {
  if (typeof value !== "string") throw new TypeError("allowed origins are required");
  const origins = new Set();
  for (const candidate of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    let url;
    try { url = new URL(candidate); } catch { throw new TypeError("allowed origin is invalid"); }
    if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.origin !== candidate) {
      throw new TypeError("allowed origin must be an exact HTTP(S) origin");
    }
    origins.add(url.origin);
  }
  if (origins.size === 0) throw new TypeError("at least one allowed origin is required");
  return origins;
}

export function createAuthRuntime({ pool, allowedOrigins, abuseControl, audit, delivery, mfa, courierWebhookSecret = process.env.COURIER_WEBHOOK_SECRET ?? null } = {}) {

  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");
  if (!delivery || typeof delivery.send !== "function") throw new TypeError("identity action delivery.send is required");
  const origins = parseAllowedOrigins(allowedOrigins instanceof Set ? [...allowedOrigins].join(",") : allowedOrigins);
  const repository = createPostgresIdentityRepository({ pool });
  const control = abuseControl ?? createInMemoryAuthAbuseControl();
  const auditSink = audit ?? createPostgresAuthAudit({ pool });
  const authService = createAuthService({
    repository,
    abuseControl: control,
    audit: auditSink,
    mfa
  });
  // Development-only demo code for customer contact verification, mirroring
  // the dev MFA adapter. Production omits it, so verify-by-code fails closed
  // until a real mail/phone delivery provider is configured.
  const contactVerifier = process.env.NODE_ENV === "development" ? createDevContactVerifier() : undefined;
  const identityActionService = createIdentityActionService({
    identityRepository: repository,
    actionRepository: createPostgresIdentityActionRepository({ pool }),
    delivery,
    abuseControl: control,
    audit: auditSink,
    contactVerifier
  });
  const userAdminService = createUserAdminService({ authService, repository: createUserAdminRepository({ pool }) });
  const addressService = createAddressService({ authService, repository: createPostgresAddressRepository({ pool }) });
  const catalogService = createCatalogService({ repository: createPostgresCatalogRepository({ pool }) });
  const catalogCommandService = createCatalogCommandService({ authService, repository: createPostgresCatalogCommandRepository({ pool }) });
  const catalogSpecCommandService = createCatalogSpecCommandService({ authService, repository: createPostgresCatalogSpecCommandRepository({ pool }) });
  const indicativePriceService = createIndicativePriceService({ authService, repository: createPostgresIndicativePriceRepository({ pool }) });
  const sellRequestService = createSellRequestService({ authService, repository: createPostgresSellRequestRepository({ pool }), indicativePriceService });
  const acquisitionService = createAcquisitionService({ authService, repository: createPostgresAcquisitionRepository({ pool }) });
  const inventoryService = createInventoryService({ authService, repository: createPostgresInventoryRepository({ pool }) });
  const inspectionTemplateService = createInspectionTemplateService({ authService, repository: createPostgresInspectionTemplateRepository({ pool }) });
  const listingRepository = createPostgresListingRepository({ pool });
  const listingService = createListingService({ authService, repository: listingRepository });
  const merchantListingService = createMerchantListingService({ authService, repository: createMerchantListingRepository({ pool }) });
  const reservationService = createReservationService({ authService, listingRepository, reservationRepository: createPostgresReservationRepository({ pool }) });
  const paymentProviderConfigRepository = createPostgresPaymentProviderConfigRepository({ pool });
  const paymentProviderConfigService = createPaymentProviderConfigService({ authService, repository: paymentProviderConfigRepository });
  const sellTaxonomyService = createSellTaxonomyService({ authService, readRepository: createPostgresSellTaxonomyRepository({ pool }), commandRepository: createPostgresSellTaxonomyCommandRepository({ pool }) });
  const siteFooterService = createSiteFooterService({ authService, repository: createPostgresSiteFooterRepository({ pool }) });
  const orderPaymentService = createOrderPaymentService({ authService, repository: createPostgresOrderPaymentRepository({ pool }), paymentProviderConfigService });

  const shipmentService = createShipmentService({ authService, repository: createPostgresShipmentRepository({ pool }), webhookSecret: courierWebhookSecret });

  const returnRequestService = createReturnRequestService({ authService, repository: createPostgresReturnRequestRepository({ pool }) });
  const warrantyClaimService = createWarrantyClaimService({ authService, repository: createPostgresWarrantyClaimRepository({ pool }) });
  const operationsReportService = createOperationsReportService({ authService, repository: createPostgresOperationsReportRepository({ pool }) });
  const notificationService = createNotificationService({ authService, repository: createPostgresNotificationRepository({ pool }) });
  const auditLogService = createAuditLogService({ authService, repository: createPostgresAuditLogRepository({ pool }) });
  return Object.freeze({ authService, identityActionService, userAdminService, addressService, catalogService, catalogCommandService, catalogSpecCommandService, sellRequestService, acquisitionService, inventoryService, inspectionTemplateService, listingService, merchantListingService, reservationService, orderPaymentService, shipmentService, returnRequestService, warrantyClaimService, operationsReportService, notificationService, auditLogService, paymentProviderConfigService, indicativePriceService, sellTaxonomyService, siteFooterService, allowedOrigins: origins });

}
