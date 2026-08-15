---
source: https://docs.google.com/document/d/1wU-8NzB0G4oKFyupd6qRbzDZcZYIvlhmg3sUKAn2irE/edit
status: approved
version: 1.0
synced: 2026-08-16
---

# PCX — SECURITY ARCHITECTURE & THREAT MODEL v1.0
Verified Used Tech Recommerce Platform — Bangladesh

## 1. SECURITY OBJECTIVES
Protect customer/seller identity and contact data; prevent account takeover; prevent inventory/price/order/payment manipulation; protect serial and acquisition information; preserve inspection evidence; prevent double sale/refund/payment replay; maintain trustworthy audit history; recover safely from infrastructure failure.

## 2. TRUST BOUNDARIES
Untrusted: public browser/PWA, uploaded files, seller declarations, payment/courier callbacks until verified, search inputs.
Semi-trusted: authenticated customers.
Privileged: support, technician, inventory, finance, admin.
Highly privileged: supervisor overrides and super-admin/security configuration.
External: payment gateway, courier, SMS/email provider, object storage/CDN.
Database, queue and internal services are private-network resources and never directly public.

## 3. PRIMARY THREATS
Credential stuffing, brute force, session theft, CSRF/XSS, IDOR/BOLA, privilege escalation, mass assignment, injection, malicious uploads, serial scraping, price tampering, inventory race/double sell, payment webhook spoof/replay, duplicate refunds, fraudulent sell submissions, evidence alteration, insider abuse, audit deletion, secret leakage, dependency compromise, backup failure and denial-of-service.

## 4. IDENTITY & SESSION
Passwords use modern adaptive hashing (Argon2id preferred where stack supports it) with appropriate parameters. Email/phone verification policy is risk-based. Admin/finance/supervisor accounts require MFA before production. Sessions/tokens are short-lived and revocable; refresh rotation/reuse detection where token model is used. Secure, HttpOnly, SameSite cookies when browser cookie sessions are used. Authentication events are logged and rate limited.

## 5. AUTHORIZATION
Server-side RBAC plus ownership/resource checks. Default deny. Endpoint permissions are explicit. Technician cannot edit price/cost/payment; support cannot issue arbitrary refunds; finance cannot alter inspection results; inventory cannot override failed verification; supervisor overrides require reason and audit. Super-admin usage should be limited and separately monitored.

## 6. DATA CLASSIFICATION
Public: listing information, approved passport disclosure.
Internal: operational status, technician workflow, market references.
Confidential: customer/seller contact/address, full serial, acquisition cost, payment references.
Restricted: credentials, tokens, secrets, security configuration, sensitive audit/security events.
Public API DTOs are separate from internal models to avoid accidental field exposure.

## 7. ENCRYPTION & SECRETS
TLS for all production traffic. Encryption at rest from managed/database/storage layer where available. Secrets live in environment/secret manager, never repository or client bundle. Separate credentials by environment/service. Rotation procedure documented. Production DB is not accessible from developer laptops without controlled access path.

## 8. INPUT & OUTPUT SECURITY
Central schema validation. Parameterized ORM/query use; raw SQL reviewed. HTML/user content encoded/sanitized. Strict allow-lists for sort/filter fields. Object IDs are non-sequential/non-guessable where exposure matters. API responses minimize fields. Errors never reveal stack traces/secrets in production.

## 9. FILE & IMAGE UPLOAD SECURITY
Allow-list MIME/extensions, size/count limits, generated storage keys, no user-controlled executable path. Verify content type rather than trusting filename. Process uploads asynchronously where practical; strip unsafe metadata where appropriate; malware scanning integration point; private evidence objects use signed/authorized access. Public listing images and private inspection/identity evidence use different access policies.

## 10. PAYMENT SECURITY
PCX stores only necessary provider references; card/payment credentials remain with compliant provider. Browser success is not payment truth. Webhooks require provider signature verification, timestamp/replay controls and unique event IDs. Refund permissions are restricted, idempotent and audited. Amount/currency/order relation is recomputed server-side.

## 11. INVENTORY & COMMERCE INTEGRITY
Database transaction/constraint prevents two active owners of a physical item. Price is loaded from authoritative listing at checkout. Reservation expiration is server controlled. Order snapshots preserve sold facts. Manual inventory/status overrides are privileged and audited. Reconciliation jobs detect payment/order/reservation mismatch.

## 12. SELLER/FRAUD CONTROLS
Seller declaration and ownership confirmation retained. Duplicate serial/device identifiers flagged. Suspicious repeated submissions, mismatched identity/contact, unusual valuation behavior and known-risk patterns can enter manual review. Future risk engine may score cases, but irreversible rejection/payment decisions should remain explainable and reviewable.

## 13. INSPECTION INTEGRITY
Submitted inspection results/evidence are immutable to normal roles. Corrections create new revision/reinspection records. Template version is preserved. Critical fail overrides require supervisor permission, reason and audit. Evidence timestamps and uploader identity retained.

## 14. AUDIT SECURITY
Append-oriented audit events for login/security, role changes, price changes, inspection overrides, acquisition payment, order/payment/refund, inventory state and warranty/return resolutions. Application roles cannot erase security audit history. Logs exclude passwords/tokens/full sensitive payloads.

15. CSRF, CORS & BROWSER SECURITY
Cookie-auth state changes use CSRF defenses. CORS uses explicit production origins, never wildcard with credentials. Security headers include CSP tuned to app, frame protections/frame-ancestors, nosniff, Referrer-Policy and HSTS in production. XSS-sensitive dynamic content is escaped by default.

## 16. RATE LIMITING & ABUSE
Layered limits on login/OTP/reset, public search, sell submissions, uploads and expensive endpoints. Use user/IP/device/risk signals carefully; provide legitimate recovery. WAF/CDN may absorb commodity abuse but application limits remain necessary.

## 17. NETWORK & ENVIRONMENTS
Separate local/dev/staging/production. Production database/cache/queue/object-storage administration is private. Public ingress reaches reverse proxy/load balancer/app only. Admin surface may receive stronger access controls/MFA and optionally network restrictions. Staging must not use copied production PII without sanitization.

## 18. DEPENDENCY & SUPPLY CHAIN
Lock dependencies, automated vulnerability scanning, minimal packages, protected main branch, code review/CI gates, secret scanning, container/image scanning if containers used, reproducible builds where practical. Critical dependency advisories have patch procedure.

## 19. BACKUP & RECOVERY SECURITY
Encrypted backups, access-restricted backup credentials, retention policy, off-primary failure-domain copy, periodic restore test. Database backup alone is insufficient: object/evidence storage and configuration needed for recovery are included. Recovery objectives (RPO/RTO) are set before production launch.

## 20. PRIVACY & RETENTION
Collect minimum data necessary for commerce, warranty, fraud/legal operations. Define retention per customer/seller/order/payment/evidence/log category. User-facing deletion/privacy requests must preserve records PCX is legally/financially required to retain while removing or anonymizing eligible data. Sensitive values are not used in analytics unnecessarily.

## 21. THREAT-TO-CONTROL MAP
Account takeover → MFA privileged roles, rate limits, secure sessions, password hashing.
IDOR → resource ownership + permission checks.
Price tamper → server-authoritative price/totals.
Double sell → transaction + unique active allocation constraint.
Webhook spoof/replay → signature + event uniqueness + idempotency.
Malicious upload → allow-list, scanning, private storage policy.
Inspection manipulation → immutable submissions + supervisor audited override.
Insider refund abuse → separated permissions + audit + limits/approval policy.
Secret leak → secret manager/environment separation + scanning/rotation.
Data loss → tested encrypted backups and restore drills.

## 22. SECURITY TEST GATES
Auth brute-force/rate-limit test; authorization matrix tests; IDOR tests across customer records; CSRF/XSS/injection tests; upload bypass tests; concurrent purchase test; payment webhook spoof/replay tests; refund idempotency tests; privilege escalation tests; public passport sensitive-field test; audit immutability test; backup restore drill.

## 23. INCIDENT RESPONSE MINIMUM
Define severity levels, owner/on-call path, containment steps, credential/secret rotation, payment-provider coordination, evidence preservation, customer communication decision process, recovery and post-incident review. Security events need timestamps/correlation IDs.

## 24. PRODUCTION SECURITY EXIT CRITERIA
No critical/high known exploitable vulnerability; privileged MFA enabled; secrets outside repo; TLS/security headers configured; authorization tests passing; payment verification tested; backups restored successfully in test; audit events verified; monitoring alerts for auth/payment/job failures; dependency and secret scans in CI.

FINAL PRINCIPLE
Trust is PCX’s product. Security controls must protect not only accounts and servers, but the truthfulness of each physical item’s identity, inspection, price, ownership, payment and post-sale history.
