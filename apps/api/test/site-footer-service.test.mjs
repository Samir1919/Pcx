import assert from "node:assert/strict";
import test from "node:test";
import { SiteFooterError, createSiteFooterService } from "../src/modules/footer/site-footer-service.mjs";

function fixture(roles = ["ADMIN"], repository) {
  let sequence = 0;
  const calls = [];
  const service = createSiteFooterService({
    authService: { async authenticateAccess() { return { userId: "actor-1", status: "ACTIVE", roles }; } },
    repository: repository ?? {
      async getActive() { calls.push(["getActive"]); return { tagline: "T", copyright: "C", linkColumns: [] }; },
      async get() { calls.push(["get"]); return { tagline: "T", copyright: "C", linkColumns: [] }; },
      async save(footer, updatedAt, event) { calls.push(["save", footer, updatedAt, event]); return footer; }
    },
    id: () => `id-${++sequence}`,
    clock: () => new Date("2026-08-20T00:00:00.000Z")
  });
  return { service, calls };
}

test("public footer never requires auth and reads the active projection", async () => {
  const { service, calls } = fixture(["CUSTOMER"]);
  const result = await service.publicFooter();
  assert.equal(result.data.tagline, "T");
  assert.deepEqual(calls[0], ["getActive"]);
});

test("admin read requires SYSTEM_CONFIGURE", async () => {
  for (const role of ["CUSTOMER", "SUPPORT", "TECHNICIAN", "SUPERVISOR", "INVENTORY", "FINANCE"]) {
    const { service } = fixture([role]);
    await assert.rejects(service.adminFooter("access"), (error) => error instanceof SiteFooterError && error.code === "forbidden");
  }
  const { service } = fixture(["ADMIN"]);
  const result = await service.adminFooter("access");
  assert.equal(result.data.tagline, "T");
});

test("save requires SYSTEM_CONFIGURE and persists normalized content with audit", async () => {
  const { service, calls } = fixture(["ADMIN"]);
  const input = {
    tagline: "  Certified marketplace  ",
    copyright: "PCX",
    linkColumns: [{ title: "Shop", links: [{ label: "Storefront", href: "/storefront" }] }]
  };
  const result = await service.save("access", input, { requestId: "r1" });
  assert.equal(result.data.tagline, "Certified marketplace");
  const save = calls.find(([name]) => name === "save");
  assert.equal(save[1].tagline, "Certified marketplace");
  assert.equal(save[2], "2026-08-20T00:00:00.000Z");
  assert.equal(save[3].action, "SITE_FOOTER_UPDATED");
  assert.equal(save[3].requestId, "r1");
});

test("save rejects unknown fields and non-root-relative hrefs", async () => {
  const { service } = fixture(["ADMIN"]);
  await assert.rejects(service.save("access", { status: "ACTIVE" }), (e) => e.code === "invalid_input");
  await assert.rejects(
    service.save("access", { linkColumns: [{ title: "X", links: [{ label: "Ext", href: "https://evil.example" }] }] }),
    (e) => e.code === "invalid_input"
  );
  await assert.rejects(
    service.save("access", { linkColumns: [{ title: "X", links: [{ label: "Ext", href: "//evil.example" }] }] }),
    (e) => e.code === "invalid_input"
  );
});

test("save normalizes social links to http(s) only and whitelists platforms", async () => {
  const { service } = fixture(["ADMIN"]);
  const result = await service.save("access", { socialLinks: [{ platform: "facebook", href: "https://facebook.com/pcx" }] });
  assert.equal(result.data.socialLinks[0].href, "https://facebook.com/pcx");
  await assert.rejects(service.save("access", { socialLinks: [{ platform: "telegram", href: "https://t.me/x" }] }), (e) => e.code === "invalid_input");
  await assert.rejects(service.save("access", { socialLinks: [{ platform: "facebook", href: "javascript:alert(1)" }] }), (e) => e.code === "invalid_input");
});
