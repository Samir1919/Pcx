# ADR 0010: Open marketplace "advertise & sell" flow

- Status: Proposed
- Date: 2026-08-22

## Context

The approved source of truth deliberately defers the open marketplace:

- `BUSINESS_PRODUCT_REQUIREMENTS.md` §4.1 keeps the MVP on PCX-owned inventory, §4.4 places consignment in Phase 2, and §4.5 places the open marketplace in Phase 3 (verified third-party seller listing, KYC, commission, seller payout, verification routing).
- §23 lists "open third-party marketplace", "automated seller payout", and "dealer portal" under NOT IN MVP.
- `USER_FLOW_SCREEN_MAP.md` §32 lists the open marketplace seller portal, seller KYC, seller listings, and commission/payout under POST-MVP SCREENS.

A product request now asks the seller flow to offer, after an indicative price is shown, a second path: "advertise on the marketplace" instead of selling directly to PCX. This requires moving marketplace scope earlier than the approved specifications allow.

## Decision

Introduce the marketplace as a bounded, server-authoritative slice rather than a client-driven listing page:

1. **Separate selling paths.** Keep the PCX-owned "Sell to PCX" acquisition flow unchanged. Add a distinct third-party seller listed-item concept that never reuses the PCX-owned `listings` table or its pricing operator.
2. **Seller eligibility is server-owned.** A user may only create an advertise listing through a privileged, audited path that verifies KYC and seller standing. The web UI may not self-grant marketplace access; it only reflects a server-issued capability.
3. **Price, status, grade, and publication are never client-authoritative.** This is the same invariant as PCX-owned pricing. The advertiser proposes a price (like the existing merchant draft), and PCX records the final sellable price and publishes it. Reservation and double-sale protections continue to be enforced server-side.
4. **Money movements stay separate.** A marketplace sale and any seller payout are separate accounting records with idempotent payment/refund operations. Payout is gated by delivery/completion state, not by client instruction. No automated payout goes live before a finance review.
5. **Specs are updated before code ships.** This ADR plus an update to `BUSINESS_PRODUCT_REQUIREMENTS.md` (move marketplace scope into the MVP boundary) are accepted before marketplace code is merged.

The in-session web work for this task stops at a decision screen with a "coming soon" marketplace placeholder; the full advertise flow is implemented only after this ADR is accepted and the phase boundary is updated in the approved specifications.

## Approval

Pending human approval. This is a hard stop under `AGENTS.md` because it changes the MVP scope and an approved source-of-truth (`BUSINESS_PRODUCT_REQUIREMENTS.md`). Acceptance must explicitly approve the phase change and any commission/payout policy.

## Consequences

- Two listing concepts coexist: PCX-owned listings (current) and third-party marketplace listings (new), each with its own lifecycle and accounting.
- A seller KYC/admission decision and a minimum commission/payout policy must be written into the specifications before implementation.
- Marketplace listings, their state machine, and payout correctness require new tests and a dedicated handoff.
- The deferral of seller KYC, commission, and payout is removed from NOT IN MVP for this slice only; dealer portal remains out of scope unless separately approved.
- The public storefront must visually distinguish a PCX-owned inspected item from a third-party advertised item so trust boundaries remain clear.
