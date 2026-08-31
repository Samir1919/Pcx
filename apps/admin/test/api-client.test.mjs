import test from "node:test";
import assert from "node:assert/strict";
import { apiRequest, ApiError } from "../lib/api-client.js";

const CSRF_COOKIE = "pcx_admin_csrf=token";

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

function withGlobals(cookie, run) {
  const priorDocument = global.document;
  const priorFetch = global.fetch;
  global.document = { cookie };
  return (async () => {
    try {
      return await run();
    } finally {
      global.document = priorDocument;
      global.fetch = priorFetch;
    }
  })();
}

test("a privileged 401 triggers one silent refresh and retries the request", async () => {
  await withGlobals(CSRF_COOKIE, async () => {
    const paths = [];
    global.fetch = async (path) => {
      paths.push(path);
      if (path === "/api/v1/auth/refresh") return response(200, { data: { status: "refreshed" } });
      if (path === "/api/v1/me") {
        return paths.filter((p) => p === "/api/v1/me").length === 1
          ? response(401, { error: { code: "UNAUTHENTICATED", message: "Authentication required" } })
          : response(200, { data: { userId: "u1" } });
      }
      throw new Error(`unexpected path: ${path}`);
    };

    const result = await apiRequest("/api/v1/me");
    assert.equal(result.data.userId, "u1");
    assert.deepEqual(paths, ["/api/v1/me", "/api/v1/auth/refresh", "/api/v1/me"]);
  });
});

test("auth endpoints never self-refresh on 401", async () => {
  await withGlobals(CSRF_COOKIE, async () => {
    const paths = [];
    global.fetch = async (path) => {
      paths.push(path);
      return response(401, { error: { code: "UNAUTHENTICATED", message: "Authentication failed" } });
    };

    await assert.rejects(
      () => apiRequest("/api/v1/auth/login", { method: "POST", body: { contact: "a@example.com", password: "x" }, csrf: false }),
      (error) => error instanceof ApiError && error.status === 401
    );
    // No refresh was attempted; only the original login call was made.
    assert.deepEqual(paths, ["/api/v1/auth/login"]);
  });
});

test("a failed refresh preserves the original 401", async () => {
  await withGlobals(CSRF_COOKIE, async () => {
    const paths = [];
    global.fetch = async (path) => {
      paths.push(path);
      if (path === "/api/v1/auth/refresh") return response(401, { error: { code: "UNAUTHENTICATED", message: "Authentication failed" } });
      if (path === "/api/v1/me") return response(401, { error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      throw new Error(`unexpected path: ${path}`);
    };

    await assert.rejects(
      () => apiRequest("/api/v1/me"),
      (error) => error instanceof ApiError && error.status === 401 && error.code === "UNAUTHENTICATED"
    );
    assert.deepEqual(paths, ["/api/v1/me", "/api/v1/auth/refresh"]);
  });
});

test("refresh without a CSRF cookie falls back to the original 401 without looping", async () => {
  await withGlobals("", async () => {
    const paths = [];
    global.fetch = async (path) => {
      paths.push(path);
      return response(401, { error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
    };

    await assert.rejects(
      () => apiRequest("/api/v1/me"),
      (error) => error instanceof ApiError && error.status === 401
    );
    // The GET /me call surfaces 401; no refresh fetch is emitted because the
    // CSRF token is missing and refresh fails closed.
    assert.deepEqual(paths, ["/api/v1/me"]);
  });
});

test("concurrent 401s share a single refresh", async () => {
  await withGlobals(CSRF_COOKIE, async () => {
    let refreshCalls = 0;
    let meCalls = 0;
    global.fetch = async (path) => {
      if (path === "/api/v1/auth/refresh") {
        refreshCalls += 1;
        return response(200, { data: { status: "refreshed" } });
      }
      if (path === "/api/v1/me") {
        meCalls += 1;
        return meCalls <= 2
          ? response(401, { error: { code: "UNAUTHENTICATED", message: "Authentication required" } })
          : response(200, { data: { userId: "u1" } });
      }
      throw new Error(`unexpected path: ${path}`);
    };

    const [a, b] = await Promise.all([apiRequest("/api/v1/me"), apiRequest("/api/v1/me")]);
    assert.equal(a.data.userId, "u1");
    assert.equal(b.data.userId, "u1");
    assert.equal(refreshCalls, 1);
  });
});
