import { hasPermission, Permission } from "@pcx/domain";

export class ReportsError extends Error {
  constructor(code) { super(code); this.name = "ReportsError"; this.code = code; }
}

export function createOperationsReportService({ authService, repository }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["counts", "recentOrders", "recentSellRequests", "inventoryCost"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.AUDIT_READ) && !hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new ReportsError("forbidden");
    return identity;
  }

  return Object.freeze({
    async dashboard(accessCredential) {
      await actor(accessCredential);
      const [counts, recentOrders, recentSellRequests, inventoryCost] = await Promise.all([
        repository.counts(),
        repository.recentOrders(),
        repository.recentSellRequests(),
        repository.inventoryCost()
      ]);
      return Object.freeze({ counts, recentOrders, recentSellRequests, inventoryCost });
    }
  });
}
