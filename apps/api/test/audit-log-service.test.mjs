import assert from "node:assert/strict";
import test from "node:test";
import { createAuditLogService } from "../src/modules/audit/audit-log-service.mjs";

test("audit list requires AUDIT_READ and returns rows", async () => {
  const rows = [{ id: "1", action: "update", entityType: "order", entityId: "o1" }];
  const service = createAuditLogService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository: { async list(filters) { return filters.entityType === "order" ? rows : []; } }
  });
  const result = await service.list("access", { entityType: "order" });
  assert.equal(result.length, 1);

  const denied = createAuditLogService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
    repository: { async list() { return []; } }
  });
  await assert.rejects(denied.list("access", {}), (e) => e.code === "forbidden");
});
