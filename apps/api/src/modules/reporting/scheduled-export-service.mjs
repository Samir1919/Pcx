import { hasPermission, Permission } from "@pcx/domain";

export class ScheduledExportError extends Error {
  constructor(code) { super(code); this.name = "ScheduledExportError"; this.code = code; }
}

const allowedReports = new Set(["operations", "audit"]);
const allowedFormats = new Set(["csv", "ndjson"]);
const allowedCadences = new Set(["daily", "weekly"]);
const createFields = new Set(["name", "report", "format", "cadence", "enabled"]);

export function createScheduledExportService({ authService, repository, id = () => crypto.randomUUID?.() ?? "export-1", clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["list", "create", "findDue", "markRun"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function reader(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.AUDIT_READ) && !hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new ScheduledExportError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new ScheduledExportError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async list(accessCredential) {
      await reader(accessCredential);
      return Object.freeze(await repository.list());
    },

    async create(accessCredential, input) {
      await reader(accessCredential);
      const fields = exact(input, createFields);
      const name = String(fields.name ?? "").trim();
      if (!name) throw new ScheduledExportError("invalid_input");
      if (!allowedReports.has(fields.report) || !allowedFormats.has(fields.format) || !allowedCadences.has(fields.cadence)) throw new ScheduledExportError("invalid_input");
      const record = {
        id: id(),
        name,
        report: fields.report,
        format: fields.format,
        cadence: fields.cadence,
        enabled: fields.enabled !== false,
        createdAt: clock().toISOString()
      };
      return Object.freeze(await repository.create(record));
    },

    // Worker entry point: run every enabled export whose cadence window has
    // elapsed. countRows(report) is injected so this stays testable and never
    // touches another module's tables directly.
    async runDue({ now = clock(), countRows = async () => 0 } = {}) {
      const due = await repository.findDue(now);
      const ran = [];
      for (const exportRow of due) {
        const lastRowCount = await countRows(exportRow.report);
        const updated = await repository.markRun(exportRow.id, now.toISOString(), lastRowCount);
        if (updated) ran.push(updated);
      }
      return Object.freeze(ran);
    }
  });
}