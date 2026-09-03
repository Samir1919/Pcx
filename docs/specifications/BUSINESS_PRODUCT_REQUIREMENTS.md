---
source: https://docs.google.com/document/d/1yu7HoKJUldJLs5AocMb9bylVT7v4VfBaec8vTOjuDv8/edit
status: approved
version: 1.0
synced: 2026-08-16
---

# PCX — BUSINESS & PRODUCT REQUIREMENTS v1.0
Verified Used Tech Recommerce Platform — Bangladesh

DOCUMENT PURPOSE
এই নথি PCX-এর business rules, operating model, MVP product scope, user journeys, data modules, technical architecture এবং launch validation framework-এর master specification। Investor pitch যেখানে “কেন এই business” ব্যাখ্যা করে, এই document সেখানে “business ও software বাস্তবে কীভাবে চলবে” নির্ধারণ করে।

## 1. PRODUCT VISION
PCX-এর লক্ষ্য সাধারণ used-PC classified marketplace হওয়া নয়। লক্ষ্য হলো বাংলাদেশের used-tech market-এর জন্য একটি trusted recommerce infrastructure তৈরি করা, যেখানে Buy, Sell, Trade-in, Verification, Warranty এবং Price Intelligence একই ecosystem-এ থাকবে।

Core Promise: Used Tech Without the Risk.
Core Loop: Acquire → Verify → Grade → Price → Sell → Protect → Buy Back / Trade-in.

প্রথম বছরে PCX নিজস্ব controlled inventory ও verification-এর মাধ্যমে trust তৈরি করবে। Open marketplace প্রথম MVP-এর অংশ হবে না।

## 2. TARGET CUSTOMER SEGMENTS
Primary customer segments:
• Gamers — কম বাজেটে performance-focused PC/GPU buyer ও upgrader।
• Students — affordable laptop/desktop প্রয়োজন।
• Freelancers & creators — workstation, editing, design ও productivity hardware।
• Developers / AI learners — CPU/GPU/RAM/VRAM-aware systems।
• Office & SME buyers — dependable refurbished desktops/laptops।
• Existing PC owners — দ্রুত sell বা upgrade করতে চান।
• Corporate buyers/sellers — bulk device acquisition ও lifecycle buyback; post-MVP focus।

## 3. LAUNCH PRODUCT CATEGORIES
MVP launch priority:
P1: Desktop PC, Laptop, GPU.
P2: CPU, Motherboard, RAM, SSD/HDD.
P3: PSU, Monitor এবং selected accessories.

প্রতিটি physical unit model-level catalog থেকে আলাদা inventory item হবে। একই model-এর দুইটি used GPU-এর health, serial, condition, purchase cost এবং selling price আলাদা থাকতে পারবে।

## 4. TRANSACTION MODELS
4.1 PCX-Owned Inventory
PCX seller-এর কাছ থেকে item কিনবে → verification → প্রয়োজন হলে cleaning/refurbishment → pricing → PCX inventory → customer sale → warranty/return support।

4.2 Sell-to-PCX
Customer product information submit করবে। System preliminary estimated range দেখাতে পারে; এটি final offer নয়। Physical verification-এর পর PCX final offer দেবে। Seller accept করলে ownership/acquisition record তৈরি হবে এবং payment হবে।

4.3 Trade-in
Customer পুরোনো verified device PCX-কে sell করে অন্য item কিনবে। Trade-in value final inspection-এর পরে confirmed হবে। Accounting-এ old-device acquisition এবং new-device sale দুইটি আলাদা transaction হিসেবে record হবে।

4.4 Consignment — Phase 2
PCX seller-এর item own না করে custody নিয়ে verify/list/sell করবে এবং sale completion-এর পরে agreed commission বাদ দিয়ে seller payout করবে।

4.5 Open Marketplace — Phase 3
Verified third-party seller listing, KYC, commission, seller payout ও verification routing যুক্ত হবে। MVP-তে নয়।

## 5. CORE BUSINESS RULES
• কোনো item “PCX Verified” badge পাবে না completed inspection ছাড়া।
• Serial/unique identifier সম্ভব হলে acquisition-এর সময় capture করতে হবে।
• Estimated online valuation কখনো guaranteed final purchase offer হিসেবে দেখানো যাবে না।
• Final grade ও health score technician inspection data থেকে আসবে।
• Repair history seller declaration এবং technician-observed evidence আলাদাভাবে রাখতে হবে।
• Product return হলে returned serial sold serial-এর সঙ্গে match করতে হবে।
• High-risk/failed inspection item verified inventory-তে publish করা যাবে না।
• Warranty period category/grade অনুযায়ী configurable হবে; hard-code করা যাবে না।
• Pricing, grade বা inspection result manual override করলে actor, timestamp ও reason audit log-এ রাখতে হবে।

## 6. CONDITION GRADING STANDARD
A+ — Like New: খুব কম cosmetic wear, সব critical tests pass, কোনো material defect detected নয়।
A — Excellent: হালকা ব্যবহারচিহ্ন, full functionality, critical tests pass।
B — Good: দৃশ্যমান cosmetic wear থাকতে পারে, কিন্তু declared functionality usable এবং critical tests pass।
C — Fair: উল্লেখযোগ্য cosmetic wear বা non-critical limitation থাকতে পারে; limitation স্পষ্টভাবে disclose করতে হবে।
Reject / Parts Only: critical failure, unsafe condition, unverifiable identity বা PCX standard পূরণ না করা।

Grade cosmetic condition-এর shorthand; এটি Health Score-এর বিকল্প নয়।

## 7. PCX HEALTH SCORE
Target score: 0–100.
Score category-specific weighted test results থেকে calculate হবে। MVP-তে formula configurable rule-based হবে, AI-generated নয়।

Suggested dimensions:
• Functional integrity
• Performance/benchmark consistency
• Thermal condition
• Component-specific health
• Physical condition
• Port/interface status
• Repair/damage risk adjustment

প্রতিটি category-এর weight আলাদা হবে। উদাহরণ: SSD-তে SMART/health বেশি গুরুত্বপূর্ণ, laptop-এ battery/display/hinge এবং GPU-তে VRAM/thermal/artifact tests বেশি গুরুত্বপূর্ণ।

## 8. VERIFICATION SOP
Universal intake:
1) Seller/customer identity reference capture যেখানে প্রয়োজন।
2) Product model confirmation.
3) Serial/identifier capture.
4) Intake photos.
5) Seller-declared age, warranty, repair history, box/invoice.
6) Physical inspection.
7) Category-specific tests.
8) Result recording.
9) Grade + Health Score.
10) Approve / Reject / Escalate.

GPU checklist: benchmark, VRAM, stress, core/hotspot temperature, artifact observation, fan, display ports, physical PCB/oxidation evidence where inspectable.
SSD/HDD checklist: SMART, health, power-on hours where available, bad sector/error indicators, capacity validation.
Laptop checklist: battery health/cycle where available, display, keyboard, trackpad, camera, Wi-Fi, ports, storage, RAM, CPU load/thermal, hinge, charger.
Desktop checklist: component identity, boot stability, CPU/GPU/RAM/storage, PSU/thermal observation, ports and sustained load.

Technician must not be able to mark mandatory critical tests blank and still approve unless supervisor override with reason is recorded.

## 9. DIGITAL PRODUCT PASSPORT
প্রতিটি verified physical item-এর public-facing passport থাকবে:
• PCX Item ID
• Product/model
• Masked serial number
• Grade
• Health Score
• Verification date
• Key test results
• Observed repair/damage disclosure
• Warranty status
• Product photos
• QR code / shareable passport URL

Internal passport-এ full serial, technician, raw test data, acquisition source এবং audit history থাকবে; public page-এ sensitive/internal fields থাকবে না।

## 10. PRICING & VALUATION ENGINE
MVP pricing rule-based/manual-assisted হবে। Inputs:
• Product model
• Age
• Grade/health
• Warranty remaining
• Repair status
• PCX historical acquisition/sales data
• Current observed market reference entered by authorized staff
• Target margin
• Inventory age

System তিনটি value আলাদা রাখবে:
1) Estimated Market Value
2) PCX Acquisition Offer
3) PCX Selling Price

Future Price Intelligence metrics: listed average, actual sold average, 30-day low/high, fair-value estimate, price trend। “Listed price” এবং “sold price” কখনো একই dataset হিসেবে treat করা যাবে না।

11. WARRANTY, RETURN & CLAIMS
Policy launch-এর আগে legal/operational review করে final করতে হবে। System configurableভাবে support করবে:
• Check/return window
• Standard warranty
• Optional extended warranty
• Category exclusions
• Claim reason
• Inspection outcome
• Repair / replace / refund resolution

Warranty claim workflow:
Claim → Eligibility check → Product receive → Serial verify → Technician diagnosis → Approve/Reject → Repair/Replace/Refund → Close.

Return fraud prevention: outbound photos, serial, security seal where applicable, condition snapshot এবং inbound comparison।

## 12. SELL-TO-PCX USER FLOW
Start → Category → Brand → Model → Specs → Condition questions → Age/warranty → Repair declaration → Photos → Contact/pickup/drop-off preference → Estimated range → Request submitted → Admin review → Final offer → Accept/Reject → Physical inspection → Payment → Inventory intake.

Statuses:
DRAFT, SUBMITTED, PRELIMINARY_REVIEW, OFFERED, ACCEPTED, INSPECTION_REQUIRED, INSPECTING, REJECTED, EXPIRED, PAID, CANCELLED.

## 13. BUYER PURCHASE FLOW
Home/Search → Product → Verification Passport → Add to Cart / Buy Now → Address → Delivery → Payment → Order confirmation → Packing → Courier → Delivered → Return/check window → Warranty lifecycle.

Product page must prioritize trust information, not শুধু specifications:
Price, grade, health score, warranty, verification summary, actual photos, condition disclosure, key test results এবং PCX ID above/before secondary marketing content।

## 14. SEARCH & DISCOVERY
Search must understand model-oriented queries such as “3060”, “RTX 3060 12GB”, “5600G”.

MVP filters:
Category, price, brand, condition grade, verified status, warranty, key category specifications.

Future filters:
Health score, age, location, socket, chipset, VRAM, generation, form factor.

Best Deal ranking future formula should combine normalized price advantage + health + grade + warranty + inventory confidence. Lowest price alone “Best Deal” নয়।

## 15. CUSTOMER ACCOUNT
MVP:
• Profile
• Addresses
• Orders
• Sell requests
• Trade-in requests when enabled
• Warranty/claims
• Saved items optional if schedule allows

Phase 2/3:
• Listings
• Seller dashboard
• Payouts
• Wallet/ledger view
• Reviews/reputation

## 16. ADMIN PANEL
Dashboard
Catalog
Inventory
Acquisitions/Purchases
Sell Requests
Orders
Customers
Verification
Technicians
Pricing
Trade-ins
Warranty & Claims
Returns/Refunds
Payments
Shipments/Courier
Reports
Users/Roles
Settings
Audit Logs

Critical admin capabilities:
• Search by PCX ID/serial/order/customer.
• View full item lifecycle.
• Prevent silent deletion of financial/verification history.
• Export operational reports.
• Role-based access.

## 17. TECHNICIAN PANEL
Technician experience mobile/tablet-friendly web interface হবে।

Queue → Receive/scan PCX ID → Intake confirmation → Test template → Record results → Upload photos/evidence → Notes → Submit → Grade/score calculation → Approve/Reject/Escalate.

Roles:
Technician: tests submit করতে পারবে।
Senior Technician/Supervisor: exception/override approve করতে পারবে।
Admin: configuration manage করবে কিন্তু audit history erase করতে পারবে না।

## 18. INVENTORY LIFECYCLE
Possible item states:
RECEIVED → INSPECTION → APPROVED → REFURBISHING(optional) → READY_TO_LIST → LISTED → RESERVED → SOLD → DELIVERED → RETURNED / WARRANTY → CLOSED.

Rejected item আলাদা state-এ যাবে এবং accidentally sellable stock-এ ফিরতে পারবে না।

Inventory record must include acquisition cost, refurbishment cost, allocated direct cost, target price, current price, days in inventory এবং final realized margin।

## 19. PAYMENT & FINANCE
MVP: standard e-commerce payment/COD integration + internal accounting records।

Required finance concepts:
• Payment
• Refund
• Seller acquisition payment
• Order revenue
• Direct cost
• Warranty/return cost
• Commission (future marketplace)
• Seller payable/payout (future)

Marketplace launch-এর আগে double-entry style internal ledger strongly recommended। “Escrow” terminology বা regulated fund-holding claim legal/payment review ছাড়া ব্যবহার করা যাবে না।

## 20. LOGISTICS
Shipment data:
Courier, tracking ID, package type, weight, COD amount, declared value where supported, shipping charge, status timeline.

PCX Safe Packaging SOP category-specific হবে। GPU, desktop, laptop ও monitor-এর packaging requirements এক নয়। Dispatch-এর আগে package/product evidence photos রাখা হবে।

## 21. NOTIFICATIONS
MVP channels: email/SMS/approved messaging channel availability অনুযায়ী।
Events:
Order placed, payment confirmed, shipped, delivered, sell request received, inspection scheduled/completed, final offer, warranty claim updates.

Notification failure business transaction rollback করবে না; retry queue থাকবে।

## 22. MVP SCOPE — MUST HAVE
Customer Web/PWA:
• Home
• Catalog/category
• Search/filter
• Product detail
• Verification passport
• Cart/Buy Now
• Checkout
• Payment/COD
• Order tracking
• Account/order history
• Sell-to-PCX request

Operations/Admin:
• Catalog/model management
• Physical inventory management
• Acquisition records
• Sell request management
• Inspection templates/results
• PCX ID + QR/passport
• Pricing/listing
• Orders/payments
• Shipment/tracking
• Warranty/return basic workflow
• Dashboard/basic reports
• Roles/audit logs

## 23. NOT IN MVP
• Open third-party marketplace
• Automated seller payout
• Dealer portal
• Auction/bidding
• User wallet
• Advanced AI advisor
• AI dynamic pricing
• Advanced used PC Builder
• Full compatibility engine
• Native Android/iOS apps
• Price Intelligence public charts
• PCX Certified partner network

এই scope discipline launch time ও complexity control করার জন্য বাধ্যতামূলক।

## 24. KEY DATABASE MODULES
IDENTITY: users, roles, permissions, addresses, customer_profiles.
CATALOG: categories, brands, product_models, model_specs, spec_definitions.
INVENTORY: inventory_items, serial_identifiers, warehouses, stock_movements, item_costs.
ACQUISITION: sell_requests, seller_declarations, offers, purchases.
VERIFICATION: inspection_templates, inspection_template_items, inspections, test_results, health_scores, inspection_media.
LISTING: listings, listing_prices, listing_media.
COMMERCE: carts, orders, order_items, payments, refunds.
TRADE_IN: trade_requests, trade_items, trade_valuations.
WARRANTY: warranties, claims, claim_inspections, claim_resolutions.
LOGISTICS: shipments, shipment_events, packaging_evidence.
FINANCE: transactions, cost_entries; ledger_entries future-ready.
CRM: tickets, notifications.
GOVERNANCE: audit_logs, configuration_versions.

## 25. CORE DATA RELATIONSHIP
Product Model = generic catalog identity.
Inventory Item = one physical used unit.
Inspection = one verification event against an Inventory Item.
Listing = commercial offer for an approved Inventory Item.
Order Item = snapshot of purchased Listing/Inventory Item.
Warranty = entitlement created from completed sale.

এই separation না করলে used-item serial-level traceability ভেঙে যাবে।

## 26. TECHNICAL ARCHITECTURE
MVP architecture: Modular Monolith.

Client Layer:
Next.js responsive web/PWA; Flutter native apps post-MVP.

Backend:
Node.js; NestJS recommended for module boundaries, validation, RBAC and maintainability. Structured Express acceptable if architecture discipline maintained.

Data:
PostgreSQL primary relational database.
Redis cache/queue/session use cases as needed.
S3-compatible object storage for product/inspection media.
Search: PostgreSQL initially; dedicated search engine when scale/quality requires.

Modules:
Auth | Catalog | Acquisition | Inventory | Verification | Listing | Pricing | Commerce | Payment | Logistics | Warranty | Notification | Reporting | Audit.

## 27. API PRINCIPLES
• REST API first.
• Versioned public/mobile-facing APIs.
• Server-side authorization on every protected action.
• Idempotency for payment/order-sensitive operations where applicable.
• Pagination/filter/sort conventions consistent across modules.
• File uploads direct-to-object-storage pattern when appropriate.
• Webhooks verified, logged and retry-safe.
• Financial and inventory state transitions transaction-safe.

## 28. SECURITY & FRAUD CONTROLS
• RBAC: Customer, Support, Technician, Supervisor, Inventory, Finance, Admin.
• Password/OTP/auth secrets never logged.
• Full serial restricted to authorized roles.
• Rate limiting on authentication endpoints.
• Audit critical changes.
• Payment webhook signature verification.
• Media upload type/size validation.
• Seller/customer KYC data minimization and controlled access.
• Backups and restore testing.
• Fraud flags for serial mismatch, repeated returns, suspicious account/device behavior — advanced scoring post-MVP.

## 29. NON-FUNCTIONAL REQUIREMENTS
• Mobile-first responsive UX.
• Core pages performant on typical Bangladesh mobile connections.
• No single user request should synchronously wait for long benchmark/processing jobs.
• Operational jobs retryable.
• Inventory and payment transitions consistent.
• Production observability: structured logs, error tracking, uptime monitoring.
• Daily database backup minimum target; recovery procedure documented before launch.
• Privacy and retention policy defined for identity/KYC/test media.

## 30. ANALYTICS & KPI EVENTS
Track:
Product viewed
Search performed
Sell request started/completed
Estimated valuation shown
Add to cart
Checkout started
Purchase completed
Return requested
Trade-in started/completed
Warranty claim

Founder metrics:
GMV, Net Revenue, Gross Margin, Contribution Margin, Orders, AOV, CAC, Conversion Rate, Inventory Days, Sell-through, Return Rate, Warranty Claim Rate, Sell-to-PCX conversion, Trade-in rate, repeat purchase rate.

## 31. MVP ACCEPTANCE CRITERIA
MVP launch-ready only when:
• Admin can create catalog model and receive a physical item.
• Technician can complete mandatory inspection and produce verified status.
• Approved item can receive PCX ID, grade, health score and passport.
• Admin can price/publish item.
• Customer can discover, inspect trust data and place order.
• Payment/COD state can be recorded reliably.
• Inventory cannot be sold twice under normal concurrent checkout flow.
• Shipment/tracking can be recorded.
• Delivered item can enter return/warranty workflow.
• Full lifecycle can be traced from PCX ID.
• Critical admin/technician actions are auditable.
• Backup and restore procedure has been tested.

## 32. DEVELOPMENT ROADMAP
Phase 0 — Business & SOP Lock (2 weeks)
Finalize grading, testing, warranty/return, pricing, taxonomy, acquisition and packaging SOP.

Phase 1 — MVP Build (6–10 weeks target)
Foundation/Auth → Catalog → Acquisition → Inventory → Verification → Listing → Storefront/Search → Cart/Checkout → Payment → Logistics → Warranty/Return → Reports → QA/Hardening.

Phase 2 — Operational Maturity (Month 3–5)
Trade-in, advanced filters, price history internally, reviews, better analytics, automation.

Phase 3 — Marketplace (Month 6–9)
Seller KYC, listings, consignment, commissions, seller payable/payout, marketplace dispute operations.

Phase 4 — Mobile (Month 9–12)
Flutter Android first, iOS based on demand/operations readiness.

Phase 5 — Intelligence
Compatibility engine, PC Builder, Price Intelligence, AI commerce advisor, fraud scoring, dynamic pricing.

## 33. VALIDATION BEFORE SCALE
Software build-এর পাশাপাশি 20–50 real transactions manually/semimanually validate করতে হবে। প্রতি transaction-এ record:
• Acquisition source
• Purchase price
• Testing/refurbishment cost
• Days to sell
• Selling price
• Payment/courier cost
• Marketing acquisition cost where attributable
• Return/warranty cost
• Contribution profit
• Buyer reason for purchase
• Seller reason for choosing PCX

Primary validation questions:
1) Buyer PCX Verified-এর কারণে কি বেশি trust করে?
2) Seller speed/convenience-এর বিনিময়ে market price-এর নিচে instant offer গ্রহণ করে কি?
3) Verification-এর operational cost কত?
4) Target inventory 30–45 দিনের মধ্যে rotate হয় কি?
5) Return/warranty reserve-এর পর contribution positive থাকে কি?

## 34. LAUNCH GATES
Gate A — SOP Ready: grading/testing/return/warranty signed off.
Gate B — Operations Ready: intake → inspection → sale → return dry-run complete.
Gate C — Product Ready: MVP acceptance criteria pass.
Gate D — Financial Ready: contribution model tested on real sample transactions.
Gate E — Launch Ready: courier/payment/support/backup/incident process ready.

## 35. FUTURE MOAT
PCX-এর defensibility software UI নয়। Long-term moat:
• Actual sold-price history
• Serial-level transaction history
• Hardware health/failure dataset
• Verification methodology and network
• Trusted PCX Verified brand
• Supply acquisition relationships
• Trade-in liquidity
• Corporate device buyback pipeline

Future PCX Certified model third-party shops-এর hardware verification/certification layer হতে পারে। তখন PCX marketplace-এর বাইরে used-tech trust infrastructure হিসেবে revenue করতে পারবে।

## 36. NEXT IMPLEMENTATION ARTIFACTS
এই requirements document approve হওয়ার পরে sequentially তৈরি হবে:
1) Detailed User Flow & Screen Map
2) Database ERD v1
3) API Specification v1
4) Admin + Technician Workflow Specification
5) UI/UX Wireframe Requirements
6) Engineering Epics/User Stories/Acceptance Criteria
7) QA/Test Plan
8) Deployment & Operations Plan
9) Launch KPI Dashboard

FINAL PRODUCT PRINCIPLE
PCX-এর প্রতিটি product decision-এর প্রশ্ন হবে: “এটি কি used-tech transaction-এ trust, liquidity অথবা operational efficiency বাড়ায়?” যদি না বাড়ায়, MVP-তে feature-টি থাকার প্রয়োজন নেই।
