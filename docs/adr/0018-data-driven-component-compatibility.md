# ADR 0018: Data-driven component compatibility

- Status: Accepted
- Date: 2026-09-07

## Context

A full PC build is a composition of parts. Certain component pairs must match:
the CPU socket must equal the motherboard socket, and the CPU/motherboard memory
type must equal the RAM memory type. Hardcoding these pairs (and the allowed
socket / memory values) in code or UI would force a code change every time a new
socket or RAM type ships.

## Decision

Model compatibility as admin-managed data, not code:

1. **Shared reference values** (`reference_values`, keyed by a canonical key
   like `socket` / `memory_type`) are the controlled vocabulary. A new socket
   (AM6) or RAM type (DDR6) is added as a row via admin CRUD.

2. **SELECT spec data type**: a spec definition can be `SELECT` with a
   `reference_key`, so its allowed values come from the shared reference list.
   The CPU and Motherboard `socket`, and the CPU/Motherboard/RAM `memory_type`
   use `SELECT`, so the same value string is shared across categories.

3. **Compatibility rules** (`compatibility_rules`) declare a relation between
   two category-scoped spec attributes with an operator. The seeded rules are
   CPU.socket EQUALS Motherboard.socket, and CPU/motherboard memory_type EQUALS
   RAM memory_type. The `EQUALS` operator is the one comparison primitive; new
   rules and values are data, and only a genuinely new comparison semantic
   would require code.

4. **Server-authoritative validation**: the build-create command evaluates every
   active rule over the chosen components and rejects the save (422) on a
   required violation. The admin configurator shows a live banner and renders
   SELECT specs as dropdowns using the same rules and reference values (generic
   evaluation, no hardcoded pairs).

## Consequences

- Migration `0060_component_compatibility.sql` adds `reference_values`,
  `compatibility_rules`, `spec_definitions.reference_key`, and the `SELECT`
  data type; seeds sockets + memory types + three rules; converts the
  socket/memory_type definitions to SELECT; adds `memory_type` to CPU and
  Motherboard.
- New backend module: compatibility repository/service/HTTP (public read of
  reference values + rules; admin CRUD; server-side check wired into
  build-create).
- Admin: a Compatibility tab (reference values + rules CRUD) and SELECT
  dropdowns + a live compatibility banner in the PC builds configurator.
