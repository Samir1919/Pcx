# State Machines

All lifecycle transitions are server-owned. Invalid or stale transitions return conflict errors; they are not silently coerced. Reservation and unique inventory constraints must prevent double sale. Submitted inspections are immutable; corrections use audited superseding records or privileged overrides.

Full source: `../specifications/API_SPECIFICATION_STATE_MACHINES.md`.
