# Architecture

Use a modular monolith with customer web, admin/technician web, API, worker, PostgreSQL, Redis, and object storage boundaries. Domain modules own rules and persistence access. Do not introduce microservices or Kubernetes without measured need and an approved ADR.

Full source: `../specifications/INFRASTRUCTURE_DEVOPS.md`.
