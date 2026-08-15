# PCX Agent Contract

Read `docs/brain/README.md` before making material changes. The approved specifications in `docs/specifications/` are the source of truth; concise brain documents are retrieval aids, not replacements.

## Mandatory invariants

- A physical used item has one unique lifecycle identity.
- `ProductModel` and `InventoryItem` are separate concepts.
- An item cannot be sold twice.
- Client input never authoritatively sets price, totals, role, status, grade, or warranty eligibility.
- Submitted inspection history is preserved.
- Critical inspection overrides are privileged, reasoned, and audited.
- Estimated seller ranges are not final offers.
- Trade-in acquisition and new sale are separate accounting records.
- Order snapshots preserve the sold facts.
- Payment, refund, and acquisition financial operations are idempotent.
- Public passports never expose full serials, acquisition cost, or private evidence.
- State transitions and authorization are enforced on the server.

## Engineering rules

- Work in bounded epics and branches. Prefer the smallest coherent change.
- Preserve modular-monolith boundaries; modules do not manipulate another module's tables directly.
- Write or update tests for changed business behavior.
- Run `npm run verify:e0`, `npm test`, and relevant checks before commit.
- Never commit credentials, production data, or private evidence.
- Record approved architecture changes as ADRs; do not silently change business truth.

## Hard stops

Stop for explicit human approval before production deployment, destructive/irreversible migration, production/customer-data deletion, payment destination or provider credential changes, production secret rotation, disabling tests/security controls, large framework replacement, or changing a core invariant/source-of-truth.
