# PCX Project Brain

Before material changes, read `AGENTS.md`, then the relevant brain files and linked approved specification.

## Source-of-truth order

1. `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`
2. `docs/specifications/USER_FLOW_SCREEN_MAP.md`
3. `docs/specifications/DATABASE_ERD.md`
4. `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`
5. `docs/specifications/SECURITY_ARCHITECTURE.md`
6. `docs/specifications/INFRASTRUCTURE_DEVOPS.md`
7. ADRs, module contracts, then task-specific specs

If approved sources conflict, the higher item wins and the conflict must be reported. Conversational assumptions are not durable decisions.

## Brain index

- `product.md`: vision, actors, and MVP boundary
- `domain-rules.md`: mandatory invariants
- `state-machines.md`: server-owned lifecycle rules
- `security.md`: trust boundaries and hard gates
- `architecture.md`: modular-monolith boundaries
- `database.md`: relational source-of-truth rules
- `api.md`: API contract principles
- `ui-ux.md`: approved screen/interaction principles
- `testing.md`: quality gates
- `devops.md`: environments and release controls
