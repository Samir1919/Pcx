# Handoff: RESERVED -> SOLD on payment confirm

- Branch: main
- Scope: confirmPayment now advances the order (PENDING_PAYMENT -> CONFIRMED) and marks each claimed listing SOLD (RESERVED -> SOLD) in the same transaction, closing the double-sell loop after payment.
- Acceptance: npm run verify passes (588 tests, 0 fail); integration test updated to assert order CONFIRMED + listing SOLD; SQL syntax validated.
- Changed: postgres-order-payment-repository.mjs (confirmPayment), order-payment repository integration test.
- Decisions: order and listing transitions are DB-guarded (WHERE status), idempotent, and run in the existing confirmPayment transaction.
- Risks: none material. Inventory item status enum still lacks SOLD/LISTED states (separate future slice).
- No blockers.
