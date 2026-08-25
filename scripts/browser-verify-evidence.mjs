/**
 * Shared browser-verification evidence schema and writer.
 *
 * This is the machine-checkable proof consumed by
 * `scripts/browser-verify-guard.mjs`. A slice that touches a browser-facing
 * surface (`apps/web` or `apps/admin`, excluding tests) must leave a committed
 * `docs/verify/browser-verify.json` record produced by a real, headed browser
 * run before `npm run verify` will pass.
 *
 * Writing an honest record is easy; fabricating one into an otherwise empty or
 * non-headed run is a guard failure. The guard re-checks `headed === true`,
 * `result === "passed"`, and a non-empty `businessFlow.steps` list.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const EVIDENCE_PATH = "docs/verify/browser-verify.json";

/**
 * Write (or overwrite) the single browser-verification evidence record.
 *
 * @param {{
 *   scope: string,
 *   headed: boolean,
 *   tool: string,
 *   result: "passed" | "failed" | "blocked",
 *   businessFlow: { subject: string, steps: string[] },
 *   notes?: string
 * }} record
 */
export async function writeEvidence(record) {
  const payload = {
    // Human/machine metadata.
    scope: String(record.scope ?? ""),
    headed: record.headed === true,
    tool: String(record.tool ?? ""),
    result: String(record.result ?? "failed"),
    businessFlow: {
      subject: String(record.businessFlow?.subject ?? ""),
      steps: Array.isArray(record.businessFlow?.steps)
        ? record.businessFlow.steps.map((s) => String(s))
        : []
    },
    notes: record.notes ? String(record.notes) : undefined,
    ranAt: new Date().toISOString()
  };

  await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

/**
 * Read and parse the current evidence file, or null when absent/invalid.
 */
export async function readEvidence() {
  try {
    const raw = await readFile(EVIDENCE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
