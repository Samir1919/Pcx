---
source: https://docs.google.com/document/d/1sdxWARXAcsQmhReNho_liV8Xl5LFfoM2zVbSbmdF8so/edit
status: approved
version: 1.0
synced: 2026-08-16
---

# PCX — DATABASE ERD v1.0
Verified Used Tech Recommerce Platform — Bangladesh

DOCUMENT PURPOSE
এই ERD specification PCX-এর persistent data model define করে। লক্ষ্য হলো catalog-level product data এবং serial-level used physical item data আলাদা রাখা, যাতে verification, pricing, order, return, warranty, finance এবং audit history নির্ভুলভাবে trace করা যায়।

## 1. CORE MODEL PRINCIPLE
ProductModel = generic catalog identity.
InventoryItem = একটি নির্দিষ্ট physical used unit.
Inspection = InventoryItem-এর উপর একটি verification event.
Listing = approved InventoryItem-এর commercial offer.
OrderItem = sale-time snapshot of one Listing/InventoryItem.
Warranty = completed sale থেকে তৈরি entitlement.

এই separation ভাঙা যাবে না। একই model-এর দুইটি GPU আলাদা serial, health, grade, cost, price ও warranty history রাখবে।

## 2. HIGH-LEVEL RELATIONSHIP MAP
Category 1→N Brand/ProductModel context
Brand 1→N ProductModel
ProductModel 1→N InventoryItem
ProductModel 1→N ModelSpecValue
ProductModel N↔N CompatibilityRule (future)

User 1→N SellRequest
SellRequest 1→N Valuation
SellRequest 1→N Offer
Accepted Offer 1→1 Acquisition
Acquisition 1→1 or 1→N InventoryItem depending intake design

InventoryItem 1→N Inspection
Inspection 1→N TestResult
Inspection 1→1 HealthScore snapshot
InventoryItem 1→N ItemCost
InventoryItem 1→N PriceHistory
InventoryItem 1→N Listing history, but max one active sellable listing

Order 1→N OrderItem
OrderItem N→1 InventoryItem
Order 1→N Payment
Order 1→N Shipment
OrderItem 1→0..1 Warranty
OrderItem 1→N ReturnRequest / Claim subject to policy

All critical entities 1→N AuditLog events through polymorphic or explicit reference strategy.

## 3. IDENTITY & ACCESS
users
id UUID PK
email nullable unique
phone nullable unique
password_hash / auth_provider fields
status
created_at, updated_at

roles
id PK
code unique: CUSTOMER, SUPPORT, TECHNICIAN, SUPERVISOR, INVENTORY, FINANCE, ADMIN, SUPER_ADMIN

permissions
id PK
code unique

user_roles
user_id FK users
role_id FK roles
UNIQUE(user_id, role_id)

role_permissions
role_id FK roles
permission_id FK permissions
UNIQUE(role_id, permission_id)

addresses
id PK
user_id FK users
label, recipient_name, phone, address lines, area, city, postal fields
is_default

Rule: authorization server-side RBAC দিয়ে enforce হবে।

## 4. CATALOG
categories
id PK
parent_id nullable FK categories
name
slug unique
status
sort_order

brands
id PK
name
slug unique
status

product_models
id PK
category_id FK categories
brand_id FK brands
name
slug unique
model_code nullable
status
search_aliases/search document strategy
created_at, updated_at

spec_definitions
id PK
category_id FK categories
key
label
data_type
unit nullable
filterable boolean
required boolean
sort_order
UNIQUE(category_id, key)

model_spec_values
id PK
product_model_id FK product_models
spec_definition_id FK spec_definitions
value_text/value_number/value_boolean/value_json strategy
UNIQUE(product_model_id, spec_definition_id)

Important: serial, grade, purchase cost, warranty and health score product_models table-এ থাকবে না।

## 5. SELL-TO-PCX & ACQUISITION
sell_requests
id PK
public_request_no unique
user_id nullable FK users
contact_name
contact_phone/email
category_id
product_model_id nullable
status
fulfilment_preference
submitted_at
created_at, updated_at

seller_declarations
id PK
sell_request_id FK
age_estimate
warranty_remaining
repair_declared boolean
repair_notes
box_available
invoice_available
ownership_declaration boolean
condition_answers JSONB বা normalized answer table

sell_request_media
id PK
sell_request_id FK
media_id FK media
purpose

valuations
id PK
sell_request_id FK
valuation_type: PRELIMINARY / POST_INSPECTION / MANUAL
low_value nullable
high_value nullable
recommended_value nullable
inputs_snapshot JSONB
created_by nullable FK users
created_at

offers
id PK
sell_request_id FK
valuation_id nullable
amount
status: ACTIVE / ACCEPTED / REJECTED / EXPIRED / WITHDRAWN
expires_at
accepted_at
created_by

acquisitions
id PK
sell_request_id nullable FK
accepted_offer_id nullable FK
seller_user_id nullable
source_type: SELL_TO_PCX / DIRECT_PURCHASE / TRADE_IN / CORPORATE / OTHER
agreed_price
payment_status
ownership_confirmed_at
acquired_at
created_by

Rule: online estimated value final acquisition price নয়। Accepted acquisition amount immutable financial basis হিসেবে রাখতে হবে; correction হলে reversing/adjustment record ব্যবহার করা ভালো।

## 6. INVENTORY — PHYSICAL UNIT CORE
inventory_items
id UUID PK
pcx_item_id unique human-readable
product_model_id FK
acquisition_id nullable FK
warehouse_id nullable FK
status
condition_grade nullable: A_PLUS / A / B / C / REJECT
current_health_score nullable
full_serial_encrypted/restricted field or serial table reference
received_at
approved_at nullable
sold_at nullable
created_at, updated_at

serial_identifiers
id PK
inventory_item_id FK
identifier_type: SERIAL / IMEI / SERVICE_TAG / OTHER
value_normalized
value_display
is_primary
UNIQUE(identifier_type, value_normalized) where business-valid

warehouses
id PK
name
location
status

stock_movements
id PK
inventory_item_id FK
from_location nullable
to_location nullable
movement_type
reference_type/reference_id
actor_user_id
timestamp

item_costs
id PK
inventory_item_id FK
cost_type: ACQUISITION / REFURBISHMENT / TESTING / PACKAGING / SHIPPING_IN / OTHER
amount
reference
created_at

Rule: inventory item hard-delete করা যাবে না once referenced by inspection/listing/order/finance. Archive/state transition ব্যবহার করতে হবে।

## 7. VERIFICATION
inspection_templates
id PK
category_id FK
name
version
status

inspection_template_items
id PK
inspection_template_id FK
code
label
result_type: PASS_FAIL / NUMBER / TEXT / SELECT / BOOLEAN
unit nullable
is_mandatory
is_critical
weight nullable
validation_rule JSONB
sort_order

inspections
id PK
inventory_item_id FK
inspection_template_id FK
technician_user_id FK
supervisor_user_id nullable
status: DRAFT / SUBMITTED / APPROVED / REJECTED / ESCALATED / SUPERSEDED
started_at
submitted_at
finalized_at
notes

 test_results
id PK
inspection_id FK
inspection_template_item_id FK
result_status nullable
value_number/text/json fields
pass_boolean nullable
notes
UNIQUE(inspection_id, inspection_template_item_id)

health_scores
id PK
inspection_id FK
inventory_item_id FK
score 0–100
formula_version
components JSONB
created_at

inspection_media
id PK
inspection_id FK
media_id FK
purpose/code

inspection_overrides
id PK
inspection_id FK
supervisor_user_id FK
reason
previous_result_snapshot
new_result_snapshot
created_at

Rules:
Mandatory critical test blank থাকলে finalize নয় unless explicit supervisor override.
Latest valid inspection থেকে public verified status derive হবে.
Old inspections overwrite নয়; reinspection নতুন record।

## 8. MEDIA & EVIDENCE
media
id UUID PK
storage_key
mime_type
size_bytes
checksum nullable
width/height nullable
uploaded_by nullable
created_at

media_links অথবা dedicated linking tables ব্যবহার করা যাবে। MVP-তে sell_request_media, inspection_media, listing_media, packaging_evidence আলাদা tables clarity বাড়াবে।

Public/private visibility flag এবং access control প্রয়োজন। Full serial বা internal evidence public media response-এ leak করা যাবে না।

## 9. LISTING & PRICING
listings
id PK
inventory_item_id FK
status: DRAFT / PUBLISHED / PAUSED / RESERVED / SOLD / ARCHIVED
public_slug unique
published_at
unpublished_at nullable
warranty_policy_id nullable

Constraint: এক InventoryItem-এর একসঙ্গে একটির বেশি active PUBLISHED/RESERVED listing না। Partial unique index recommended.

listing_prices
id PK
listing_id FK
price
valid_from
valid_to nullable
reason
set_by_user_id

অথবা price_history inventory_item-level রাখা যেতে পারে; recommendation: commercial price listing-level, cost inventory-level।

market_price_references
id PK
product_model_id FK
source_type
observed_price
condition_context nullable
reference_date
entered_by/source metadata

Important: listed asking price এবং actual sold price আলাদা analytics dataset।

10. CART, RESERVATION & DOUBLE-SELL PROTECTION
carts
id PK
user_id nullable
session_key nullable
status
expires_at

cart_items
id PK
cart_id FK
inventory_item_id FK
listing_id FK
price_snapshot
UNIQUE(cart_id, inventory_item_id)

reservations
id PK
inventory_item_id FK
cart_id/order_id nullable
status: ACTIVE / CONVERTED / EXPIRED / CANCELLED
reserved_until
created_at

Critical constraint: একই inventory_item-এর max one ACTIVE reservation.

Checkout transaction pattern:
1) lock/check inventory row
2) verify LISTED + no active reservation
3) create reservation atomically
4) payment/order completion হলে reservation CONVERTED + inventory SOLD
5) timeout/failure হলে release

এই design double-sell prevention-এর core।

## 11. ORDERS
orders
id UUID PK
order_no unique
user_id nullable
status
currency
subtotal
shipping_amount
discount_amount
total_amount
shipping_address_snapshot JSONB
contact_snapshot JSONB
placed_at
created_at, updated_at

order_items
id PK
order_id FK
inventory_item_id FK
listing_id nullable FK
product_model_id FK
pcx_item_id_snapshot
product_name_snapshot
spec_snapshot JSONB
grade_snapshot
health_score_snapshot
passport_snapshot/version ref
unit_price
warranty_policy_snapshot JSONB

Constraint: inventory_item_id globally unique across successful non-cancelled sale allocation, অথবা state+transaction logic দিয়ে enforce। Used unique physical item quantity সবসময় 1।

Order snapshot principle: catalog পরে edit হলেও historical invoice/order data বদলাবে না।

## 12. PAYMENTS & REFUNDS
payments
id PK
order_id nullable FK
acquisition_id nullable FK
payment_direction: INBOUND / OUTBOUND
provider
provider_transaction_id nullable unique
method
amount
status
initiated_at
confirmed_at nullable
raw_reference safe fields

refunds
id PK
payment_id FK
order_id FK
amount
reason
status
provider_ref nullable
created_at

financial_transactions / ledger_entries
Phase 1-এ simple transaction journal রাখা যায়; marketplace launch-এর আগে double-entry style ledger strongly recommended.

Webhook rule: provider event idempotentভাবে process করতে হবে। Duplicate callback duplicate payment/order তৈরি করবে না।

## 13. LOGISTICS
shipments
id PK
order_id FK
courier
tracking_id nullable
status
package_type
weight
cod_amount nullable
shipping_charge
created_at
shipped_at
delivered_at

shipment_events
id PK
shipment_id FK
status
provider_status_raw
occurred_at

packaging_evidence
id PK
shipment_id FK
inventory_item_id FK
media_id FK
purpose

Return-to-origin পৃথক shipment status/event হিসেবে track হবে।

14. WARRANTY, RETURN & CLAIMS
warranty_policies
id PK
name
category_id nullable
check_window_days
warranty_days
rules JSONB
status
version

warranties
id PK
order_item_id FK unique
inventory_item_id FK
policy_snapshot JSONB
starts_at
ends_at
status

return_requests
id PK
order_item_id FK
status
reason_code
customer_notes
requested_at
received_at nullable
resolution_type nullable
resolution_amount nullable

claims
id PK
warranty_id FK
order_item_id FK
status
reason_code
symptoms
requested_at
received_at nullable
resolved_at nullable

claim_inspections
id PK
claim_id FK
inspection_id FK

claim_resolutions
id PK
claim_id FK
resolution_type: REPAIR / REPLACE / REFUND / REJECT
notes
cost_amount nullable
approved_by
created_at

Return এবং Warranty Claim business/reporting-এ আলাদা entity থাকবে।

## 15. TRADE-IN — PHASE 2
trade_requests
id PK
user_id
status
target_listing_id nullable
created_at

trade_items
id PK
trade_request_id
old_product_model_id
sell_request_id nullable
acquisition_id nullable

trade_settlements
id PK
trade_request_id
old_device_final_value
new_order_id
customer_payable
status

Rule: trade-in discount হিসেবে শুধু net figure store নয়; old acquisition + new sale separately traceable।

## 16. NOTIFICATION & CRM
notifications
id PK
user_id nullable
channel
notification_type
reference_type/reference_id
status
payload_snapshot
scheduled_at/sent_at

support_tickets
id PK
user_id
order_id nullable
claim_id nullable
status
subject
created_at

Notification failure primary business transaction rollback করবে না। Outbox/queue pattern recommended।

## 17. AUDIT & GOVERNANCE
audit_logs
id bigserial PK
actor_user_id nullable
action
entity_type
entity_id
before_snapshot nullable JSONB
after_snapshot nullable JSONB
reason nullable
ip/device context optional
created_at

configuration_versions
id PK
config_type
version
payload JSONB
status
effective_from
created_by

Audit mandatory for:
inspection override
price change
manual payment/refund state change
role/permission change
inventory state override
warranty resolution override
sensitive serial/KYC access where practical

## 18. KEY DATABASE CONSTRAINTS
A) product_models.slug unique.
B) pcx_item_id unique.
C) normalized primary serial unique where applicable.
D) one active reservation per inventory item.
E) one active published listing per inventory item.
F) test result unique per inspection + template item.
G) one warranty per order item.
H) provider transaction/webhook identifiers idempotent.
I) historical referenced records soft-delete/archive only.
J) monetary values NUMERIC/DECIMAL; float নয়।
K) timestamps timezone-aware.
L) all state transitions validated in application/domain layer; critical uniqueness DB constraint দিয়ে reinforce।

## 19. RECOMMENDED INDEXES
inventory_items(product_model_id, status)
inventory_items(pcx_item_id)
serial_identifiers(value_normalized)
listings(status, published_at)
reservations(inventory_item_id, status, reserved_until)
orders(user_id, placed_at desc)
orders(order_no)
sell_requests(user_id, status, created_at)
inspections(inventory_item_id, finalized_at desc)
payments(provider_transaction_id)
shipments(tracking_id)
claims(warranty_id, status)
audit_logs(entity_type, entity_id, created_at desc)

Search-specific model/spec indexes পরে query pattern অনুযায়ী tune করতে হবে।

## 20. DELETION & IMMUTABILITY POLICY
Hard delete allowed primarily for unreferenced setup/draft data.
Never hard-delete completed acquisition, finalized inspection, sold order item, confirmed payment, refund, warranty resolution or audit history from normal admin UI.

Correction pattern:
financial → adjustment/reversal
inspection → reinspection/supersede
price → new history row
catalog → version/update while order snapshot stays immutable

## 21. ERD SUMMARY MAP
USER
 ├─ SELL_REQUEST ─ VALUATION ─ OFFER ─ ACQUISITION
 │                                      │
 │                                      ↓
 └─ ORDER                         INVENTORY_ITEM ← PRODUCT_MODEL
      │                                  │
      ├─ ORDER_ITEM ────────────────┐    ├─ INSPECTION ─ TEST_RESULT
      │                             │    ├─ HEALTH_SCORE
      ├─ PAYMENT                    │    ├─ LISTING ─ PRICE_HISTORY
      ├─ SHIPMENT                   │    └─ ITEM_COST
      │                             │
      └─ ORDER_ITEM → WARRANTY → CLAIM / RETURN

Core identity chain:
ProductModel → InventoryItem → Inspection → Listing → Reservation → OrderItem → Warranty/Return/Claim.

## 22. HANDOFF TO API & STATE MACHINE SPEC
Next document-এ প্রতিটি entity ব্যবহার করে REST resources, commands, request/response contracts এবং state transition rules define হবে। বিশেষভাবে lock করতে হবে:
Sell Request transition
Inventory transition
Inspection finalization
Listing publish/reserve
Checkout reservation
Order/payment transition
Return/warranty transition
Role permissions
Idempotency rules

FINAL DATA PRINCIPLE
PCX database-এর সবচেয়ে গুরুত্বপূর্ণ invariant:
“একটি physical used item-এর identity এবং lifecycle acquisition থেকে final sale/return/warranty পর্যন্ত কখনো বিচ্ছিন্ন হবে না।”
