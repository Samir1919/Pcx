---
source: https://docs.google.com/document/d/1QocH69xv5WSdVKzJMNhSZQefgf0Bh5sYaCZXVGpeRxk/edit
status: approved
version: 1.0
synced: 2026-08-16
---

# PCX — DETAILED USER FLOW & SCREEN MAP v1.0
Verified Used Tech Recommerce Platform — Bangladesh

DOCUMENT PURPOSE
এই document PCX-এর customer-facing এবং internal operational interfaces-এর screen-by-screen flow define করে। এটি Business & Product Requirements v1.0-এর implementation companion। পরের Database ERD, API Specification এবং Agentic Coding backlog এই flow-কে source হিসেবে ব্যবহার করবে।

Design principle: প্রতিটি critical action-এর clear start, state change, success state, failure state এবং recovery path থাকবে।

## 1. ACTORS & ACCESS SURFACES
Customer / Buyer — public storefront, account, order, warranty.
Seller — Sell-to-PCX এবং future trade-in flow.
Guest — browse/search/product passport; checkout-এর আগে identity/contact প্রয়োজন।
Admin — catalog, inventory, pricing, orders, sell requests, reports.
Technician — inspection queue, test templates, evidence, approval/escalation.
Supervisor — inspection override, exception approval.
Finance — payment/refund/acquisition payment visibility.
Support — customer/order/warranty case handling.

Primary surfaces:
A) Customer Web/PWA
B) Admin Web
C) Technician Mobile/Tablet Web
D) Future Native App

## 2. GLOBAL NAVIGATION — CUSTOMER
Top navigation:
Logo → Home
Search
Buy
Sell to PCX
Trade-in (Phase 2)
Categories
Account
Cart

Mobile bottom navigation:
Home | Search | Sell | Orders | Account

Global trust shortcuts:
PCX Verified কী
Warranty
How Verification Works
Support

## 3. CUSTOMER MASTER FLOW
ENTRY
→ Home / Search / Category / Shared Product Link / QR Passport
→ Product Discovery
→ Product Detail
→ Verification Passport
→ Add to Cart / Buy Now
→ Authentication or Guest Contact Verification
→ Address
→ Delivery Method
→ Payment Method
→ Review Order
→ Place Order
→ Order Confirmation
→ Packing / Shipment
→ Delivery
→ Check/Return Window
→ Warranty Lifecycle

Critical rule: unique used item reserved হলে অন্য customer একই physical unit purchase complete করতে পারবে না।

## 4. HOME SCREEN
Purpose: দ্রুত product discovery + trust communication + Sell-to-PCX acquisition.

Primary blocks:
Hero Search — “What are you looking for?”
Quick actions — Buy | Sell to PCX | Trade-in
Verified PCs
Verified Laptops
Verified GPUs
Hot Deals / Price Drops
Recently Added
Shop by Category
Why PCX Verified
How Sell-to-PCX Works
Warranty / Buyer Protection summary

Primary actions:
Search → Search Results
Category → Category Listing
Product card → Product Detail
Sell to PCX → Sell Flow
PCX Verified explainer → Trust/Verification Page

## 5. SEARCH & CATEGORY FLOW
Search entry:
User types model/category/spec keywords
→ autocomplete suggestions
→ Search Results
→ filter/sort
→ Product Detail

Result card minimum:
Actual product image
Model
Price
Grade
Health Score
Warranty summary
PCX Verified badge
Key spec
Availability

MVP filters:
Category, brand, price, condition grade, warranty, category-specific specs.

Empty state:
No exact item → related models + “Notify/Save Search” future option + Sell-to-PCX CTA where relevant.

## 6. PRODUCT DETAIL SCREEN
Above-the-fold priority:
Product name
Actual unit photos
PCX ID
Price
Grade
Health Score
PCX Verified
Warranty
Availability
Buy Now / Add to Cart

Trust section:
Verification summary
Critical tests
Observed defects/repair disclosure
Condition notes
Masked serial
Verification date
Link to Full Digital Passport

Commerce section:
Delivery estimate
Payment options
Return/check window
Warranty details
Related compatible/alternative products

State behavior:
AVAILABLE → Buy enabled
RESERVED → Buy disabled / reservation notice
SOLD → Buy disabled / similar products
UNPUBLISHED → public inaccessible

## 7. DIGITAL PRODUCT PASSPORT FLOW
Entry:
Product Detail → Full Verification Report
OR QR scan → Passport URL

Public passport:
PCX ID
Model
Grade
Health Score
Key tests
Condition disclosure
Masked serial
Actual photos
Warranty status
Verification status

Internal-only:
Full serial
Raw benchmark/test values
Technician identity
Acquisition source/cost
Override history
Internal notes

If verification is revoked/reinspection required, public passport must show current status rather than stale “Verified”.

## 8. CART & UNIQUE-INVENTORY RESERVATION
Add to Cart:
Product Detail → Add
→ Cart

Cart shows:
Physical item/PCX ID
Price
Grade
Warranty
Delivery estimate
Remove
Proceed to Checkout

Reservation rule:
Cart alone should not indefinitely lock inventory.
A short configurable reservation begins at checkout/payment-critical stage.
Expired/failed checkout releases reservation.
Successful order converts reservation → SOLD allocation.

## 9. CHECKOUT FLOW
Cart / Buy Now
→ Sign in / Continue with verified contact
→ Delivery Address
→ Delivery Method
→ Payment Method
→ Order Review
→ Accept applicable terms
→ Place Order
→ Payment redirect/confirmation where needed
→ Order Created
→ Confirmation

Failure branches:
Payment failed → Retry / Change method
Item reservation expired → return to product alternatives
Address invalid → correction
Courier service unavailable → alternative delivery method / support path

Order snapshot must preserve sold item price/spec/grade/passport reference even if catalog later changes.

## 10. ORDER TRACKING & POST-PURCHASE
Order Confirmation
→ PROCESSING
→ PACKING
→ SHIPPED
→ OUT_FOR_DELIVERY where available
→ DELIVERED

Customer order detail:
Order ID
PCX Item ID
Payment status
Shipment tracking
Invoice/receipt
Passport
Return/check eligibility
Warranty status
Support

After delivery:
Within return/check window → Request Return
After window / within warranty → Warranty Claim

## 11. RETURN FLOW
Order Detail
→ Request Return
→ Select eligible item
→ Reason
→ Evidence upload if required
→ Request submitted
→ Eligibility review
→ Product return instruction/pickup
→ Receive item
→ Serial/security evidence match
→ Technician assessment
→ Approve / Reject / Partial resolution
→ Refund / Replacement / Repair where policy allows
→ Closed

System must distinguish RETURN from WARRANTY CLAIM for reporting and rules.

## 12. WARRANTY CLAIM FLOW
Account → Warranty
→ Select covered item
→ Claim reason
→ Symptoms + evidence
→ Submit
→ Eligibility check
→ Claim accepted for inspection / rejected with reason
→ Receive item
→ Serial verify
→ Technician diagnosis
→ Resolution: Repair / Replace / Refund / Reject
→ Customer update
→ Close

Each status change creates timeline/audit event.

## 13. SELL-TO-PCX MASTER FLOW
Sell CTA
→ Choose Category
→ Brand
→ Model
→ Variant/Specs
→ Age & warranty
→ Condition questionnaire
→ Repair history declaration
→ Box/invoice/accessories
→ Photos
→ Seller contact
→ Pickup / Drop-off preference
→ Preliminary estimated range
→ Submit
→ Admin preliminary review
→ Inspection required
→ Physical intake
→ Verification
→ Final offer
→ Seller Accept / Reject
→ Ownership/acquisition confirmation
→ Payment
→ Inventory created

Important: Estimated Range ≠ Final Offer.

## 14. SELL-TO-PCX SCREEN MAP
S01 Sell Landing — benefits, process, categories.
S02 Category Select.
S03 Brand/Model Select.
S04 Specification Confirmation.
S05 Condition Questionnaire.
S06 Repair/Warranty/Ownership Declaration.
S07 Photo Upload.
S08 Contact & Fulfilment Preference.
S09 Estimated Range & Disclaimer.
S10 Review Submission.
S11 Request Confirmation.
S12 Request Status.
S13 Final Offer.
S14 Acceptance & Seller Confirmation.
S15 Payment Completion.

Status timeline visible to seller:
SUBMITTED → REVIEWING → OFFERED → ACCEPTED/REJECTED → INSPECTION_REQUIRED → INSPECTING → PAID/CLOSED.

## 15. TRADE-IN FLOW — PHASE 2
Product Detail / Account → Trade-in
→ Identify old device
→ Sell-to-PCX style questionnaire
→ Estimated trade value
→ Select target product
→ Reserve target product only when operationally safe
→ Physical inspection old device
→ Final trade value
→ Customer accepts
→ Old device acquisition recorded
→ New order generated
→ Customer pays difference / settlement
→ New order fulfilment

Accounting: trade-in must never be stored as one opaque discount; old-device acquisition and new-device sale are separate records.

## 16. CUSTOMER ACCOUNT SCREEN MAP
A01 Dashboard — recent orders, sell requests, warranty.
A02 Profile.
A03 Addresses.
A04 Orders.
A05 Order Detail.
A06 Sell Requests.
A07 Sell Request Detail.
A08 Trade-ins (when enabled).
A09 Warranty & Claims.
A10 Claim Detail.
A11 Saved Items (optional MVP).
A12 Support Tickets (optional MVP / may be external initially).

## 17. ADMIN MASTER NAVIGATION
Dashboard
Catalog
Product Models
Sell Requests
Acquisitions
Inventory
Verification
Listings
Pricing
Orders
Payments
Shipments
Returns
Warranty Claims
Customers
Technicians
Reports
Users & Roles
Settings
Audit Logs

Admin universal search:
PCX ID / serial / order / customer phone-email / sell request.

## 18. ADMIN DASHBOARD
Founder/operations summary:
Today orders
GMV / sales
Gross & contribution indicators where data available
Inventory count/value
Inventory ageing
Items awaiting inspection
Sell requests pending
Orders requiring action
Returns/warranty claims
Payment exceptions
Low/high-performing categories

Dashboard cards link directly to filtered operational queues.

## 19. ADMIN — CATALOG & PRODUCT MODEL FLOW
Catalog → Category
→ Brand
→ Product Model
→ Define model specs
→ Define category attributes
→ Define compatible inspection template
→ Save

Catalog model is generic identity; no serial, purchase cost or health score belongs here.

Admin can:
Create/Edit/Archive model
Manage aliases for search
Manage specification definitions
Prevent deletion when historical items reference model

## 20. ADMIN — SELL REQUEST & ACQUISITION FLOW
Sell Requests Queue
→ Open Request
→ Seller declaration/photos
→ Preliminary review
→ Request inspection / reject / request more info
→ Schedule/intake
→ Create or link physical intake
→ Inspection result
→ Final offer
→ Seller decision
→ Acquisition payment
→ Ownership confirmation
→ Create Inventory Item

Acquisition record contains source, seller reference, agreed price, payment status, declaration and evidence.

## 21. ADMIN — INVENTORY FLOW
Receive physical item
→ Assign temporary intake reference
→ Link Product Model
→ Capture serial/identifier
→ Intake photos
→ Inspection
→ Approved/Rejected
→ Refurbishment if needed
→ Cost entries
→ PCX ID
→ Pricing
→ Listing
→ Reserved
→ Sold
→ Delivered
→ Return/Warranty if applicable
→ Closed

Inventory detail screen must show full lifecycle timeline and financial basis.

## 22. ADMIN — LISTING & PRICING FLOW
Approved inventory item
→ Pricing workspace
→ View acquisition cost + refurbishment/direct costs + market references + target margin + inventory age
→ Set asking price
→ Choose warranty configuration
→ Review public product data/passport
→ Publish

Price changes:
New price
Reason
Actor
Timestamp
Previous price retained in history

Cannot publish unapproved/rejected inventory.

## 23. ADMIN — ORDER OPERATIONS
Orders Queue
→ Order Detail
→ Payment status
→ Reserved physical item
→ Fraud/exception checks
→ Confirm
→ Packing
→ Attach packaging evidence
→ Create shipment
→ Tracking
→ Delivered
→ Close / Return / Warranty lifecycle

Exceptions:
Payment mismatch
Stock conflict
Courier failure
Customer cancellation
Return-to-origin
Damaged shipment

## 24. TECHNICIAN MASTER FLOW
Login
→ Inspection Queue
→ Open Job
→ Receive/Confirm PCX or Intake ID
→ Verify model/serial
→ Intake condition
→ Load category test template
→ Complete mandatory tests
→ Attach evidence/photos
→ Notes
→ Submit
→ System validates mandatory fields
→ Health Score calculation
→ Suggested grade
→ Technician confirmation
→ APPROVE / REJECT / ESCALATE
→ Supervisor review if needed
→ Complete

Technician cannot edit acquisition price, selling price or finance fields.

## 25. TECHNICIAN SCREEN MAP
T01 Queue — assigned/unassigned inspections.
T02 Item Identity — model, serial, intake photos.
T03 Physical Inspection.
T04 Functional Test Checklist.
T05 Benchmark/Test Data.
T06 Thermal/Health Data.
T07 Evidence Upload.
T08 Defect/Repair Observation.
T09 Review & Submit.
T10 Result — grade/health/status.
T11 Escalation.
T12 Reinspection History.

UX: large controls, autosave, mobile/tablet friendly, clear PASS/FAIL/NA with mandatory evidence where policy requires.

## 26. SUPERVISOR OVERRIDE FLOW
Technician escalates OR mandatory exception occurs
→ Supervisor opens case
→ Reviews raw tests/evidence
→ Approve override / request retest / reject item
→ Reason mandatory
→ Audit event
→ Recomputed final status

No silent override of failed critical test.

## 27. ROLE & PERMISSION BOUNDARIES
Customer: own account/order/sell/claim data.
Support: customer/order visibility; no arbitrary financial override.
Technician: inspection data only.
Supervisor: inspection exception/override.
Inventory: stock/intake/packing.
Finance: payments/refunds/acquisition payments.
Admin: configuration and broad operations.
Super Admin: user/role/security-sensitive configuration.

Sensitive actions require server-side RBAC, not UI hiding only.

## 28. SYSTEM STATE MACHINES — UI VIEW
Inventory:
RECEIVED → INSPECTION → APPROVED → REFURBISHING(optional) → READY_TO_LIST → LISTED → RESERVED → SOLD → DELIVERED → CLOSED
Alternate: INSPECTION → REJECTED
Post-sale: DELIVERED → RETURNED / WARRANTY → CLOSED

Sell Request:
DRAFT → SUBMITTED → REVIEWING → OFFERED → ACCEPTED → INSPECTION_REQUIRED → INSPECTING → PAID → CLOSED
Alternate: REJECTED / EXPIRED / CANCELLED

Order:
PENDING → CONFIRMED → PROCESSING → PACKING → SHIPPED → DELIVERED → COMPLETED
Alternate: CANCELLED / PAYMENT_FAILED / RETURN_REQUESTED / RETURNED

UI actions shown must be derived from current state + user role.

29. ERROR, EMPTY & RECOVERY STATES
Every screen must define:
Loading
Empty
Validation error
Permission denied
Network/API failure
Conflict/state changed
Retry
Cancel/back behavior

Critical examples:
Product sold while user is checking out → graceful conflict + alternatives.
Technician loses network → preserve draft locally/server autosave where possible.
Payment callback delayed → show “processing”, do not create duplicate charge/order.
Duplicate serial detected → block intake and escalate.

## 30. NOTIFICATION TOUCHPOINTS
Customer:
Order placed / payment status / shipped / delivered / return / warranty.
Seller:
Sell request received / inspection required / final offer / accepted / payment.
Internal:
Inspection overdue / payment exception / shipment exception / warranty SLA.

Notification links deep-link to the relevant detail screen.

## 31. MVP SCREEN INVENTORY — BUILD FIRST
Customer/PWA:
Home
Search/Category
Product Detail
Digital Passport
Cart
Checkout
Order Confirmation
Order Detail/Tracking
Account
Sell-to-PCX screens
Basic Return/Warranty request

Admin:
Dashboard
Catalog/Product Model
Sell Request Queue/Detail
Acquisition
Inventory Queue/Detail
Inspection Result View
Pricing/Listing
Orders
Shipment
Returns/Warranty
Users/Roles
Audit basics

Technician:
Queue
Inspection workflow
Evidence
Submit/Result
Escalation

## 32. POST-MVP SCREENS
Trade-in optimization
Open marketplace seller portal
Seller KYC
Seller listings
Commission/payout
Dealer portal
Advanced PC Builder
Compatibility checker
Price Intelligence charts
AI Advisor
PCX Certified partner portal
Native mobile app-specific experiences

## 33. UX ACCEPTANCE PRINCIPLES
A screen is not complete unless:
User knows current state.
Primary next action is obvious.
Trust-critical information is not buried.
Critical destructive/financial actions have confirmation.
Errors explain recovery.
No internal-only data leaks publicly.
Serial-level item identity remains visible to operations.
Mobile layout works for primary flows.
State transitions cannot be bypassed from UI.

## 34. HANDOFF TO DATABASE ERD
This flow implies core entities:
User
Address
ProductModel
InventoryItem
SerialIdentifier
SellRequest
SellerDeclaration
Offer
Acquisition
Inspection
InspectionTemplate
TestResult
HealthScore
Listing
PriceHistory
Cart
Reservation
Order
OrderItem
Payment
Refund
Shipment
Warranty
Claim
Return
Media/Evidence
Notification
AuditLog

Next step: Database ERD v1 will convert every important screen/state into persistent entities, relationships, constraints and indexes.

FINAL FLOW PRINCIPLE
PCX-এর UX-এর মূল নিয়ম: “একটি used physical item-এর identity, trust data এবং lifecycle কখনো হারাবে না।”

Customer-এর কাছে flow হবে simple; operations-এর কাছে traceability হবে deep. এই দুইটি একসাথে বজায় রাখাই PCX product architecture-এর মূল উদ্দেশ্য।
