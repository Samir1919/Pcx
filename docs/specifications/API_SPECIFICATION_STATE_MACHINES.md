---
source: https://docs.google.com/document/d/1GnoKLqSJ2xi9MDTsvTC4v2Xlm3JHeN-pEegdmFhaeBc/edit
status: approved
version: 1.0
synced: 2026-08-16
---

# PCX — API SPECIFICATION & STATE MACHINES v1.0
Verified Used Tech Recommerce Platform — Bangladesh

## 1. PURPOSE
This specification converts the approved PCX product flows and ERD into implementation contracts. REST APIs are versioned under /api/v1. All state-changing operations require authentication where applicable, server-side authorization, validation, idempotency for financial/critical actions, and audit events.

## 2. API CONVENTIONS
Base: /api/v1
JSON request/response; UTC timestamps in ISO-8601; UUID/ULID internal IDs; human-readable PCX IDs separately.
Standard success: {data, meta?}. Standard error: {error:{code,message,details?,requestId}}.
Pagination: cursor-based for operational/high-volume lists; filters and sort explicitly allow-listed.
Critical POST actions accept Idempotency-Key. Optimistic concurrency/version field is required for inventory/order workflows susceptible to concurrent changes.
Never trust price, role, inventory status, grade, warranty eligibility or totals supplied by the client.

## 3. AUTH & IDENTITY API
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/verify-contact
POST /auth/forgot-password
POST /auth/reset-password
GET /me
PATCH /me
GET|POST|PATCH|DELETE /me/addresses
RBAC roles: customer, support, technician, supervisor, inventory, finance, admin, super_admin. Permissions are enforced server-side.

## 4. PUBLIC CATALOG API
GET /categories
GET /brands
GET /product-models
GET /product-models/:id
GET /search?q=
GET /listings
GET /listings/:id
GET /passport/:pcxId
Public passport returns only approved disclosure fields and masked identifiers. Internal serial/acquisition data never appears here.

5. CART, RESERVATION & CHECKOUT API
GET /cart
POST /cart/items
DELETE /cart/items/:id
POST /checkout/reservations
GET /checkout/reservations/:id
POST /checkout/quote
POST /orders
GET /orders/:id
Reservation creation must atomically verify InventoryItem=LISTED/AVAILABLE and ensure no active reservation/sale exists. Database constraint/transaction is the final authority; UI checks are insufficient.
Reservation has expiresAt. Expiry releases inventory. Successful order allocation consumes reservation exactly once.
Order creation snapshots product name/specification, PCX ID, grade, passport reference, unit price, warranty terms and tax/fee/delivery amounts.

## 6. PAYMENT API
POST /payments/intents
POST /payments/:id/confirm where provider flow requires
POST /payments/webhooks/:provider
GET /payments/:id
POST /admin/refunds
GET /admin/refunds/:id
Webhook processing is signature-verified and idempotent. Payment provider callback cannot directly trust browser success. Order paid status changes only from verified payment state.

## 7. ORDER & FULFILMENT API
GET /me/orders
GET /me/orders/:id
POST /admin/orders/:id/confirm
POST /admin/orders/:id/pack
POST /admin/orders/:id/ship
POST /admin/orders/:id/cancel
POST /admin/orders/:id/mark-delivered where integration/manual policy permits
GET /admin/orders
GET /admin/orders/:id
POST /admin/shipments
PATCH /admin/shipments/:id
Packing evidence can be attached before shipment.

## 8. SELL-TO-PCX API
POST /sell-requests
GET /me/sell-requests
GET /me/sell-requests/:id
PATCH /sell-requests/:id while DRAFT/allowed correction state
POST /sell-requests/:id/submit
POST /sell-requests/:id/media
GET /admin/sell-requests
GET /admin/sell-requests/:id
POST /admin/sell-requests/:id/request-info
POST /admin/sell-requests/:id/request-inspection
POST /admin/sell-requests/:id/reject
POST /admin/sell-requests/:id/offers
POST /sell-requests/:id/offers/:offerId/accept
POST /sell-requests/:id/offers/:offerId/reject
POST /admin/acquisitions
POST /admin/acquisitions/:id/pay
Estimated range and final offer are distinct objects and states.

## 9. INVENTORY API
POST /admin/intakes
GET /admin/inventory
GET /admin/inventory/:id
POST /admin/inventory/:id/identify
POST /admin/inventory/:id/media
POST /admin/inventory/:id/costs
POST /admin/inventory/:id/refurbishment
POST /admin/inventory/:id/assign-pcx-id
POST /admin/inventory/:id/ready-to-list
Serial identifiers are normalized and protected by uniqueness rules appropriate to identifier type. Duplicate detection blocks intake and creates an exception.

## 10. INSPECTION API
GET /technician/inspections
POST /admin/inspections
GET /inspections/:id
POST /inspections/:id/start
PUT /inspections/:id/results/:testKey
POST /inspections/:id/evidence
POST /inspections/:id/submit
POST /inspections/:id/approve
POST /inspections/:id/reject
POST /inspections/:id/escalate
POST /supervisor/inspections/:id/retest
POST /supervisor/inspections/:id/override
Inspection templates are versioned. An inspection records the exact template version used. Submitted results become immutable except through controlled correction/reinspection events.

## 11. LISTING & PRICING API
POST /admin/listings
PATCH /admin/listings/:id
POST /admin/listings/:id/publish
POST /admin/listings/:id/unpublish
POST /admin/listings/:id/price
GET /admin/listings/:id/price-history
Publish requires approved inventory, completed disclosure/passport data, valid price and configured warranty. Every price change records previous/new price, actor, timestamp and reason.

## 12. RETURN & WARRANTY API
POST /orders/:orderId/returns
GET /me/returns
GET /admin/returns
POST /admin/returns/:id/approve-intake
POST /admin/returns/:id/receive
POST /admin/returns/:id/assess
POST /admin/returns/:id/resolve
GET /me/warranties
POST /warranties/:id/claims
GET /me/claims
GET /admin/claims
POST /admin/claims/:id/accept
POST /admin/claims/:id/receive
POST /admin/claims/:id/diagnose
POST /admin/claims/:id/resolve
Return eligibility and warranty eligibility are evaluated from persisted policy snapshots, dates, item identity and order state—not client claims.

## 13. ADMIN CATALOG API
CRUD /admin/categories
CRUD /admin/brands
CRUD /admin/product-models
CRUD /admin/attribute-definitions
CRUD /admin/inspection-templates
Historical referenced records are archived rather than destructively deleted.

14. USERS, ROLES, AUDIT & NOTIFICATIONS
GET /admin/users
PATCH /admin/users/:id/status
GET /admin/roles
PATCH /admin/users/:id/roles
GET /admin/audit-logs
GET /me/notifications
POST /me/notifications/:id/read
Audit log captures actor, action, target type/id, before/after or change summary, timestamp, request ID and relevant reason. Security-sensitive logs are append-only to normal application roles.

## 15. INVENTORY STATE MACHINE
RECEIVED → INSPECTION
INSPECTION → APPROVED | REJECTED | ESCALATED
ESCALATED → INSPECTION/APPROVED/REJECTED through supervisor action
APPROVED → REFURBISHING | READY_TO_LIST
REFURBISHING → REINSPECTION/READY_TO_LIST
READY_TO_LIST → LISTED
LISTED → RESERVED | UNPUBLISHED
RESERVED → LISTED on expiry/cancel OR SOLD on successful allocation
SOLD → DELIVERED
DELIVERED → CLOSED | RETURN_PROCESS | WARRANTY_PROCESS
Illegal transitions return 409 STATE_TRANSITION_NOT_ALLOWED.

## 16. SELL REQUEST STATE MACHINE
DRAFT → SUBMITTED → REVIEWING
REVIEWING → OFFERED | INFO_REQUIRED | REJECTED
INFO_REQUIRED → REVIEWING
OFFERED → ACCEPTED | REJECTED_BY_SELLER | EXPIRED
ACCEPTED → INSPECTION_REQUIRED
INSPECTION_REQUIRED → INSPECTING
INSPECTING → ACQUISITION_PENDING | REJECTED
ACQUISITION_PENDING → PAID → CLOSED
Cancellation is allowed only in policy-defined pre-acquisition states.
Physical inspection occurs after the seller accepts the offer (see ADR 0016).

## 17. ORDER STATE MACHINE
PENDING_PAYMENT → CONFIRMED after verified payment/COD confirmation policy
CONFIRMED → PROCESSING → PACKING → SHIPPED → DELIVERED → COMPLETED
Pre-shipment allowed states may → CANCELLED.
Payment failure → PAYMENT_FAILED and reservation release according to policy.
DELIVERED may open RETURN_REQUESTED or WARRANTY lifecycle without rewriting historical order states.

## 18. INSPECTION STATE MACHINE
QUEUED → IN_PROGRESS → SUBMITTED
SUBMITTED → APPROVED | REJECTED | ESCALATED
ESCALATED → RETEST_REQUIRED | APPROVED_OVERRIDE | REJECTED
RETEST_REQUIRED creates a new inspection/revision relation; previous submitted evidence remains preserved.
Critical test failures cannot be silently overwritten.

## 19. RETURN STATE MACHINE
REQUESTED → ELIGIBILITY_REVIEW → APPROVED_FOR_RETURN | REJECTED
APPROVED_FOR_RETURN → IN_TRANSIT/EXPECTED → RECEIVED → ASSESSING
ASSESSING → REFUND_APPROVED | REPLACEMENT_APPROVED | REPAIR_APPROVED | REJECTED_AFTER_ASSESSMENT
Resolution → CLOSED.

## 20. WARRANTY CLAIM STATE MACHINE
SUBMITTED → ELIGIBILITY_REVIEW → ACCEPTED_FOR_INSPECTION | REJECTED
ACCEPTED_FOR_INSPECTION → ITEM_RECEIVED → DIAGNOSING
DIAGNOSING → REPAIR | REPLACE | REFUND | REJECT
Resolution completion → CLOSED.

## 21. PAYMENT STATE MACHINE
CREATED → PENDING → AUTHORIZED/CAPTURED or FAILED
AUTHORIZED → CAPTURED | VOIDED
CAPTURED → PARTIALLY_REFUNDED | REFUNDED
Provider webhook event IDs are unique to prevent duplicate processing.

## 22. CONCURRENCY & DOUBLE-SELL CONTROL
The physical InventoryItem is the lockable sellable resource. Checkout reservation and final order allocation execute inside database transactions. Only one active reservation/allocation can own an item. API returns 409 ITEM_UNAVAILABLE if another transaction wins. Expired reservations are released by transaction-safe worker jobs. Payment arriving after expiry enters reconciliation; it must never silently sell an already allocated item.

## 23. IDEMPOTENCY
Mandatory for order creation, payment intent/capture processing, acquisition payment, refund and critical external callbacks. Idempotency record stores key, actor/scope, request fingerprint, response reference and expiry. Same key + different payload is rejected.

## 24. VALIDATION & SECURITY RULES
Schema validation at API boundary; authorization after authentication and resource ownership checks; rate limits on auth/search/public abuse surfaces; upload MIME/size validation and malware-safe handling; secrets never returned; PII minimized; serial masking on public surfaces; sensitive field changes audited; CSRF protection where cookie auth is used; secure cookies/session/token rotation as architecture dictates.

## 25. HTTP STATUS CONTRACT
200 read/update success; 201 created; 202 asynchronous accepted; 204 successful no-content; 400 malformed request; 401 unauthenticated; 403 unauthorized; 404 absent/inaccessible resource; 409 conflict/state/concurrency; 422 semantic validation; 429 rate limited; 500 unexpected; 503 temporary dependency failure.

## 26. ASYNC JOBS & EVENTS
Jobs: reservation expiry, notification delivery, image processing, payment reconciliation, courier sync, warranty SLA alerts, search indexing, report aggregation.
Domain events include InventoryReceived, InspectionSubmitted, InventoryApproved, ListingPublished, ReservationCreated/Expired, OrderPlaced/Paid/Shipped/Delivered, SellRequestSubmitted, OfferAccepted, AcquisitionPaid, ReturnRequested/Resolved, WarrantyClaimSubmitted/Resolved.
Use transactional outbox or equivalent reliability pattern for events that must follow committed DB state.

## 27. OBSERVABILITY
Every request gets requestId/correlationId. Structured logs exclude secrets. Metrics: API latency/error, checkout conflict, payment failure, inspection throughput, reservation expiry, job failure. Critical state transitions and external integrations are traceable end-to-end.

## 28. API ACCEPTANCE GATES
No endpoint may bypass state machine rules. No public endpoint leaks internal serial/cost/technician-sensitive data. No price/payment total is client-authoritative. No critical write lacks audit/idempotency where specified. Concurrent purchase test proves a physical item cannot be sold twice. Webhook replay test proves duplicate provider events do not duplicate financial effects.

## 29. HANDOFF TO SECURITY & INFRASTRUCTURE
Next artifacts must define threat model, auth/session architecture, secrets, encryption, PII retention, backup/restore, environments, CI/CD, observability stack, queues/workers, storage/CDN and deployment topology before production coding is treated as launch-ready.

FINAL PRINCIPLE
APIs do not merely expose CRUD. They enforce PCX business truth: one physical item, one traceable lifecycle, verified trust data, controlled state transitions, and financially idempotent operations.
