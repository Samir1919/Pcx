# Testing

Every changed domain rule needs unit tests. Critical flows add integration tests. Checkout requires concurrency coverage; payments require replay/idempotency tests; privileged and object access require role/ownership matrices and IDOR regression. Build, lint, type checks, migrations, and secret scans gate merge as capabilities are introduced.
