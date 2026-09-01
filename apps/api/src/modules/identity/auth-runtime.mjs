import { createInMemoryAuthAbuseControl } from "./auth-abuse-control.mjs";
import { createAuthService } from "./auth-service.mjs";
import { createPostgresAuthAudit } from "./postgres-auth-audit.mjs";
import { createPostgresIdentityRepository } from "./postgres-identity-repository.mjs";
import { createUserAdminRepository } from "./user-admin-repository.mjs";
import { createUserAdminService } from "./user-admin-service.mjs";
import { createPostgresIdentityActionRepository } from "./postgres-identity-action-repository.mjs";
import { createIdentityActionService } from "./identity-action-service.mjs";
import { createDevContactVerifier } from "./dev-contact-verifier.mjs";
import { createProviderMfa } from "./provider-mfa.mjs";
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
import { createPostgresItemCostRepository } from "../inventory/postgres-item-cost-repository.mjs";
import { createItemCostService } from "../inventory/item-cost-service.mjs";
import { createPostgresInspectionTemplateRepository } from "../inspection/postgres-inspection-template-repository.mjs";
import { createInspectionTemplateService } from "../inspection/inspection-template-service.mjs";
import { createPostgresInspectionExecutionRepository } from "../inspection/postgres-inspection-execution-repository.mjs";
import { createInspectionExecutionService } from "../inspection/inspection-execution-service.mjs";
import { createPostgresListingRepository } from "../listing/postgres-listing-repository.mjs";
import { createListingService } from "../listing/listing-service.mjs";
import { createMerchantListingRepository } from "../listing/merchant-listing-repository.mjs";
import { createMerchantListingService } from "../listing/merchant-listing-service.mjs";
import { createPostgresReservationRepository } from "../commerce/postgres-reservation-repository.mjs";
import { createReservationService } from "../commerce/reservation-service.mjs";
import { createPostgresCartRepository } from "../commerce/postgres-cart-repository.mjs";
import { createCartService } from "../commerce/cart-service.mjs";
import { createLocalMediaStorage } from "../media/local-media-storage.mjs";
import { createPostgresMediaRepository } from "../media/postgres-media-repository.mjs";
import { createMediaService } from "../media/media-service.mjs";
import { createPostgresOrderPaymentRepository } from "../commerce/postgres-order-payment-repository.mjs";
import { createOrderPaymentService } from "../commerce/order-payment-service.mjs";
import { createPostgresShipmentRepository } from "../logistics/postgres-shipment-repository.mjs";
import { createShipmentService } from "../logistics/shipment-service.mjs";
import { createPostgresReturnRequestRepository } from "../warranty/postgres-return-request-repository.mjs";
import { createReturnRequestService } from "../warranty/return-request-service.mjs";
import { createPostgresWarrantyClaimRepository } from "../warranty/postgres-warranty-claim-repository.mjs";
import { createWarrantyClaimService } from "../warranty/warranty-claim-service.mjs";
import { createPostgresWarrantyPolicyRepository } from "../warranty/postgres-warranty-policy-repository.mjs";
import { createWarrantyPolicyService } from "../warranty/warranty-policy-service.mjs";
import { createPostgresOperationsReportRepository } from "../reporting/postgres-operations-report-repository.mjs";
import { createOperationsReportService } from "../reporting/operations-report-service.mjs";
import { createPostgresScheduledExportRepository } from "../reporting/postgres-scheduled-export-repository.mjs";
import { createScheduledExportService } from "../reporting/scheduled-export-service.mjs";
import { createPostgresNotificationRepository } from "../notification/postgres-notification-repository.mjs";
import { createNotificationService } from "../notification/notification-service.mjs";
import { createPostgresNotificationProviderConfigRepository } from "../notification/postgres-notification-provider-config-repository.mjs";
import { createNotificationProviderConfigService } from "../notification/notification-provider-config-service.mjs";
import { createContactDeliveryService } from "../notification/contact-delivery-service.mjs";
import { createNotificationEmitter } from "../notification/notification-emitter.mjs";
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

const httpsSchemes = new Set(["http:", "https:"]);

function wellFormedOrigin(candidate) {
  if (typeof candidate !== "string") return null;
  let url;
  try { url = new URL(candidate); } catch { return null; }
  if (!httpsSchemes.has(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.origin !== candidate) return null;
  return url;
}

// A Set subclass that keeps exact-origin semantics by default and can opt into a
// development-only relaxation: accept any well-formed HTTP(S) origin whose port
// matches a configured origin's port. This lets a developer reach the local
// stack from another device over a dynamic (WiFi) LAN IP (e.g.
// http://192.168.1.50:3001) without re-hardcoding the IP each time the DHCP
// lease changes. Production and staging never enable this flag.
class AllowedOrigins extends Set {
  #ported = false;

  relaxToConfiguredPorts() {
    this.#ported = true;
    return this;
  }

  has(origin) {
    if (super.has(origin)) return true;
    if (!this.#ported) return false;
    const url = wellFormedOrigin(origin);
    if (!url || url.port === "") return false;
    for (const allowed of this) {
      if (new URL(allowed).port === url.port) return true;
    }
    return false;
  }
}

export function parseAllowedOrigins(value) {
  if (typeof value !== "string") throw new TypeError("allowed origins are required");
  const origins = new AllowedOrigins();
  for (const candidate of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    const url = wellFormedOrigin(candidate);
    if (!url) throw new TypeError("allowed origin must be an exact HTTP(S) origin");
    origins.add(url.origin);
  }
  if (origins.size === 0) throw new TypeError("at least one allowed origin is required");
  return origins;
}

export function createAuthRuntime({ pool, allowedOrigins, adminOrigins, abuseControl, audit, delivery, mfa, courierWebhookSecret = process.env.COURIER_WEBHOOK_SECRET ?? null } = {}) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");
  if (!delivery || typeof delivery.send !== "function") throw new TypeError("identity action delivery.send is required");
  const origins = parseAllowedOrigins(allowedOrigins instanceof Set ? [...allowedOrigins].join(",") : allowedOrigins);
  // Development-only: allow any host on the configured app ports so the local
  // stack is reachable over a dynamic WiFi/LAN IP without hardcoding it. The
  // double-submit CSRF token still protects every write. Production and staging
  // keep the exact allow-list.
  if (process.env.NODE_ENV === "development") origins.relaxToConfiguredPorts();
  const adminOriginValue = adminOrigins instanceof Set ? [...adminOrigins].join(",") : (adminOrigins ?? "");
  const adminOriginsSet = adminOriginValue.trim() === "" ? new AllowedOrigins() : parseAllowedOrigins(adminOriginValue);
  if (process.env.NODE_ENV === "development") adminOriginsSet.relaxToConfiguredPorts();
  const repository = createPostgresIdentityRepository({ pool });
  const control = abuseControl ?? createInMemoryAuthAbuseControl();
  const auditSink = audit ?? createPostgresAuthAudit({ pool });
  // MFA resolution: an explicitly injected MFA (dev/test) always wins. When none
  // is injected, privileged login uses the provider-based MFA, which depends on
  // the contact delivery service built below (and the notification provider
  // config, which itself depends on authService). A lazy holder avoids that
  // construction cycle; the provider MFA is only instantiated on first use.
  let providerMfa = null;
  const effectiveMfa = mfa ?? Object.freeze({
    beginChallenge: (input) => providerMfa.beginChallenge(input),
    verifyChallenge: (input) => providerMfa.verifyChallenge(input)
  });
  const authService = createAuthService({
    repository,
    abuseControl: control,
    audit: auditSink,
    mfa: effectiveMfa
  });
  // Development-only demo code for customer contact verification, mirroring
  // the dev MFA adapter. Production omits it, so verify-by-code fails closed
  // until a real mail/phone delivery provider is configured.
  const contactVerifier = process.env.NODE_ENV === "development" ? createDevContactVerifier() : undefined;
  const notificationProviderConfigService = createNotificationProviderConfigService({
    authService,
    repository: createPostgresNotificationProviderConfigRepository({ pool })
  });
  // Synchronous OTP/verification/reset delivery now routes through the active
  // EMAIL (Resend) / SMS (bdBulksms) provider config instead of a no-op. The
  // fallback no-op from the caller is only used when the runtime is constructed
  // without a pool-backed delivery for tests.
  const contactDeliveryService = createContactDeliveryService({ providerConfig: notificationProviderConfigService });
  if (!mfa) {
    providerMfa = createProviderMfa({ identityRepository: repository, contactDeliveryService });
  }
  const identityActionService = createIdentityActionService({
    identityRepository: repository,
    actionRepository: createPostgresIdentityActionRepository({ pool }),
    delivery: contactDeliveryService,
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
  const notificationRepository = createPostgresNotificationRepository({ pool });
  const emitterRepository = createPostgresNotificationRepository({ pool });
  const notificationEmitter = createNotificationEmitter({ repository: emitterRepository });
  const sellRequestService = createSellRequestService({ authService, repository: createPostgresSellRequestRepository({ pool }), indicativePriceService, catalogService, notificationEmitter });
  const acquisitionService = createAcquisitionService({ authService, repository: createPostgresAcquisitionRepository({ pool }), notificationEmitter });
  const inventoryRepository = createPostgresInventoryRepository({ pool });
  const inventoryService = createInventoryService({ authService, repository: inventoryRepository, acquisitionCostResolver: (acquisitionId) => acquisitionService.getAcquisitionAgreedPrice(acquisitionId) });
  const itemCostService = createItemCostService({ authService, repository: createPostgresItemCostRepository({ pool }) });
  const inspectionTemplateRepository = createPostgresInspectionTemplateRepository({ pool });
  const inspectionTemplateService = createInspectionTemplateService({ authService, repository: inspectionTemplateRepository });
  const inspectionExecutionService = createInspectionExecutionService({ authService, inventoryRepository, inspectionTemplateRepository, repository: createPostgresInspectionExecutionRepository({ pool }) });
  const auditLogRepository = createPostgresAuditLogRepository({ pool });
  const auditLogService = createAuditLogService({ authService, repository: auditLogRepository });
  const listingRepository = createPostgresListingRepository({ pool });
  const listingService = createListingService({ authService, repository: listingRepository, auditLogService });
  const merchantListingService = createMerchantListingService({ authService, repository: createMerchantListingRepository({ pool }) });
  const reservationService = createReservationService({ authService, listingRepository, reservationRepository: createPostgresReservationRepository({ pool }) });
  const cartService = createCartService({ authService, listingRepository, cartRepository: createPostgresCartRepository({ pool }) });
  const mediaService = createMediaService({ authService, repository: createPostgresMediaRepository({ pool }), storage: createLocalMediaStorage() });
  const paymentProviderConfigRepository = createPostgresPaymentProviderConfigRepository({ pool });
  const paymentProviderConfigService = createPaymentProviderConfigService({ authService, repository: paymentProviderConfigRepository });
  const sellTaxonomyService = createSellTaxonomyService({ authService, readRepository: createPostgresSellTaxonomyRepository({ pool }), commandRepository: createPostgresSellTaxonomyCommandRepository({ pool }) });
  const siteFooterService = createSiteFooterService({ authService, repository: createPostgresSiteFooterRepository({ pool }) });
  const orderPaymentRepository = createPostgresOrderPaymentRepository({ pool });
  const orderPaymentService = createOrderPaymentService({ authService, repository: orderPaymentRepository, paymentProviderConfigService, notificationEmitter });

  // The logistics module resolves the buyer for a shipment through the commerce
  // module's public getUserIdByOrder method (never a raw cross-module query),
  // then emits customer notifications through the shared outbox emitter.
  const shipmentService = createShipmentService({
    authService,
    repository: createPostgresShipmentRepository({ pool }),
    webhookSecret: courierWebhookSecret,
    notificationEmitter,
    orderUserResolver: async ({ orderId }) => orderPaymentService.getUserIdByOrder(orderId)
  });

  const returnRequestService = createReturnRequestService({ authService, repository: createPostgresReturnRequestRepository({ pool }) });
  const warrantyClaimService = createWarrantyClaimService({ authService, repository: createPostgresWarrantyClaimRepository({ pool }) });
  const warrantyPolicyService = createWarrantyPolicyService({ authService, repository: createPostgresWarrantyPolicyRepository({ pool }) });
  const operationsReportService = createOperationsReportService({ authService, repository: createPostgresOperationsReportRepository({ pool }) });
  const scheduledExportService = createScheduledExportService({ authService, repository: createPostgresScheduledExportRepository({ pool }) });
  const notificationService = createNotificationService({ authService, repository: notificationRepository });

  return Object.freeze({
    authService,
    identityActionService,
    userAdminService,
    addressService,
    catalogService,
    catalogCommandService,
    catalogSpecCommandService,
    sellRequestService,
    acquisitionService,
    inventoryService,
    itemCostService,
    inspectionTemplateService,
    inspectionExecutionService,
    listingService,
    merchantListingService,
    reservationService,
    cartService,
    mediaService,
    orderPaymentService,
    shipmentService,
    returnRequestService,
    warrantyClaimService,
    warrantyPolicyService,
    operationsReportService,
    scheduledExportService,
    notificationService,
    notificationProviderConfigService,
    auditLogService,
    paymentProviderConfigService,
    indicativePriceService,
    sellTaxonomyService,
    siteFooterService,
    allowedOrigins: origins,
    adminOrigins: adminOriginsSet
  });
}
