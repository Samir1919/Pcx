# Domain Rules

The mandatory invariants in `AGENTS.md` apply to every task. PostgreSQL is transactional truth. Redis, queues, search, and clients never become authoritative for inventory, orders, payments, or roles. Cross-module changes go through application contracts. State transitions are explicit, validated, and audited.

Full sources: `../specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`, `../specifications/DATABASE_ERD.md`.
