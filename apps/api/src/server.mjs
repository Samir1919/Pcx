import { createServer } from "node:http";
import { handleAuthRequest } from "./modules/identity/auth-http.mjs";
import { handleSelfRequest } from "./modules/identity/self-http.mjs";
import { handleAddressRequest } from "./modules/identity/address-http.mjs";
import { handleCatalogCommandRequest } from "./modules/catalog/catalog-command-http.mjs";
import { handleCatalogSpecCommandRequest } from "./modules/catalog/catalog-spec-command-http.mjs";
import { handleSellRequestRequest } from "./modules/acquisition/sell-request-http.mjs";
import { handleAcquisitionRequest } from "./modules/acquisition/acquisition-http.mjs";
import { handleInventoryRequest } from "./modules/inventory/inventory-http.mjs";
import { handleInspectionTemplateRequest } from "./modules/inspection/inspection-template-http.mjs";
import { handleListingRequest } from "./modules/listing/listing-http.mjs";
import { handleReservationRequest } from "./modules/commerce/reservation-http.mjs";
import { handleOrderPaymentRequest } from "./modules/commerce/order-payment-http.mjs";
import { handleShipmentRequest } from "./modules/logistics/shipment-http.mjs";
import { handleCourierWebhookRequest } from "./modules/logistics/shipment-webhook-http.mjs";

import { handleReturnRequest } from "./modules/warranty/return-request-http.mjs";
import { handleWarrantyClaimRequest } from "./modules/warranty/warranty-claim-http.mjs";
import { handleOperationsReportRequest } from "./modules/reporting/operations-report-http.mjs";
import { handleNotificationRequest } from "./modules/notification/notification-http.mjs";
import { handleAuditLogRequest } from "./modules/audit/audit-log-http.mjs";
import { handlePaymentProviderConfigRequest } from "./modules/payment/payment-provider-config-http.mjs";
import { handleIndicativePriceRequest } from "./modules/pricing/indicative-price-http.mjs";

const catalogQueryKeys = new Set(["categoryId", "brandId", "q", "cursor", "limit", "sort"]);
const catalogSorts = new Set(["name_asc", "name_desc"]);

class InvalidRequestError extends Error { }

function send(response, status, body) {
  response.writeHead(status).end(JSON.stringify(body));
}

function requestId(request) {
  const value = request.headers?.["x-request-id"];
  return typeof value === "string" && value.length > 0 && value.length <= 128 ? value : "unavailable";
}

function catalogFilters(url) {
  for (const key of url.searchParams.keys()) {
    if (!catalogQueryKeys.has(key)) throw new InvalidRequestError(`unsupported query parameter: ${key}`);
    if (url.searchParams.getAll(key).length > 1) throw new InvalidRequestError(`duplicate query parameter: ${key}`);
  }
  const limitValue = url.searchParams.get("limit");
  const limit = limitValue == null ? 20 : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new InvalidRequestError("limit must be an integer from 1 to 50");
  const sort = url.searchParams.get("sort") ?? "name_asc";
  if (!catalogSorts.has(sort)) throw new InvalidRequestError("unsupported catalog sort");
  const categoryId = url.searchParams.get("categoryId");
  const brandId = url.searchParams.get("brandId");
  const q = url.searchParams.get("q");
  const cursor = url.searchParams.get("cursor");
  if (categoryId && categoryId.length > 128) throw new InvalidRequestError("categoryId is too long");
  if (brandId && brandId.length > 128) throw new InvalidRequestError("brandId is too long");
  if (q && q.length > 100) throw new InvalidRequestError("q is too long");
  if (cursor && cursor.length > 512) throw new InvalidRequestError("cursor is too long");
  return Object.freeze({
    categoryId,
    brandId,
    q,
    cursor,
    limit,
    sort
  });
}

export function createRequestHandler({ readiness = () => ({ ok: true }), catalogService, catalogCommandService, catalogSpecCommandService, authService, identityActionService, addressService, sellRequestService, acquisitionService, inventoryService, inspectionTemplateService, listingService, reservationService, orderPaymentService, shipmentService, returnRequestService, warrantyClaimService, operationsReportService, notificationService, auditLogService, paymentProviderConfigService, indicativePriceService, allowedOrigins } = {}) {

  return async (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
    const url = new URL(request.url, "http://pcx.local");
    const method = request.method ?? "GET";
    if (url.pathname === "/health/live") {
      send(response, 200, { status: "ok" });
      return;
    }
    if (url.pathname === "/health/ready") {
      const state = await readiness();
      send(response, state.ok ? 200 : 503, { status: state.ok ? "ready" : "not_ready" });
      return;
    }

    if (await handleAuthRequest(request, response, { authService, identityActionService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleCatalogSpecCommandRequest(request, response, { catalogSpecCommandService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleCatalogCommandRequest(request, response, { catalogCommandService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleAddressRequest(request, response, { addressService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleSellRequestRequest(request, response, { sellRequestService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleAcquisitionRequest(request, response, { acquisitionService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleInventoryRequest(request, response, { inventoryService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleInspectionTemplateRequest(request, response, { inspectionTemplateService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleListingRequest(request, response, { listingService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleReservationRequest(request, response, { reservationService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleOrderPaymentRequest(request, response, { orderPaymentService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleShipmentRequest(request, response, { shipmentService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleCourierWebhookRequest(request, response, { shipmentService, requestId: requestId(request) })) return;
    if (await handleReturnRequest(request, response, { returnRequestService, allowedOrigins, requestId: requestId(request) })) return;

    if (await handleWarrantyClaimRequest(request, response, { warrantyClaimService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleOperationsReportRequest(request, response, { operationsReportService, requestId: requestId(request) })) return;
    if (await handleNotificationRequest(request, response, { notificationService, requestId: requestId(request) })) return;
    if (await handleAuditLogRequest(request, response, { auditLogService, requestId: requestId(request) })) return;
    if (await handlePaymentProviderConfigRequest(request, response, { paymentProviderConfigService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleIndicativePriceRequest(request, response, { indicativePriceService, allowedOrigins, requestId: requestId(request) })) return;
    if (await handleSelfRequest(request, response, { authService, requestId: requestId(request) })) return;

    const publicCatalogPath = url.pathname === "/api/v1/categories"
      || url.pathname === "/api/v1/brands"
      || url.pathname === "/api/v1/product-models"
      || url.pathname.startsWith("/api/v1/product-models/");
    if (!publicCatalogPath) {
      send(response, 404, { error: { code: "NOT_FOUND", message: "Resource not found", requestId: requestId(request) } });
      return;
    }
    if (method !== "GET") {
      send(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed", requestId: requestId(request) } });
      return;
    }
    if (!catalogService) {
      send(response, 503, { error: { code: "CATALOG_UNAVAILABLE", message: "Catalog is temporarily unavailable", requestId: requestId(request) } });
      return;
    }

    try {
      if ((url.pathname === "/api/v1/categories" || url.pathname === "/api/v1/brands") && url.searchParams.size > 0) {
        throw new InvalidRequestError("query parameters are not supported for this resource");
      }
      if (url.pathname === "/api/v1/categories") return send(response, 200, await catalogService.listCategories());
      if (url.pathname === "/api/v1/brands") return send(response, 200, await catalogService.listBrands());
      if (url.pathname === "/api/v1/product-models") return send(response, 200, await catalogService.listProductModels(catalogFilters(url)));
      let id;
      try {
        id = decodeURIComponent(url.pathname.slice("/api/v1/product-models/".length));
      } catch {
        throw new InvalidRequestError("product model ID is malformed");
      }
      if (!id || id.includes("/")) return send(response, 404, { error: { code: "NOT_FOUND", message: "Resource not found", requestId: requestId(request) } });
      const model = await catalogService.getProductModel(id);
      return model
        ? send(response, 200, { data: model })
        : send(response, 404, { error: { code: "PRODUCT_MODEL_NOT_FOUND", message: "Product model not found", requestId: requestId(request) } });
    } catch (error) {
      const validation = error instanceof InvalidRequestError;
      return send(response, validation ? 400 : 500, {
        error: {
          code: validation ? "INVALID_REQUEST" : "INTERNAL_ERROR",
          message: validation ? error.message : "Unexpected server error",
          requestId: requestId(request)
        }
      });
    }
  };
}

export function createApiServer(options = {}) {
  return createServer(createRequestHandler(options));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.API_PORT || 4000);
  createApiServer().listen(port, () => process.stdout.write(`PCX API listening on ${port}\n`));
}
