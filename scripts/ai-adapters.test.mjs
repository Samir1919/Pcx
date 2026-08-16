import assert from "node:assert/strict";
import test from "node:test";
import { createDeepSeekExecutor } from "./ai-executor.mjs";
import { createOpenAiReviewer } from "./ai-review.mjs";

const task = (id, overrides = {}) => ({
  id,
  owner: "worker-1",
  scope: [`scope:${id}`],
  affectedPaths: [`apps/${id}.mjs`],
  tests: [`test:${id}`],
  risk: "LOW",
  ...overrides
});

const okResponse = (content) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] })
});

const errorResponse = (status) => ({
  ok: false,
  status,
  json: async () => ({})
});

test("deepseek executor sends the task to the API and returns a validated artifact", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return okResponse(JSON.stringify({ summary: "done", artifactPath: "apps/api/src/a.mjs" }));
  };
  const executor = createDeepSeekExecutor({ apiKey: "test-key", model: "deepseek-chat", fetchImpl });
  const result = await executor({ task: task("api"), actions: ["read", "edit"] });
  assert.deepEqual(result.artifacts, [{ type: "commit", path: "apps/api/src/a.mjs", status: "ok" }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-key");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, "deepseek-chat");
  assert.match(body.messages[0].content, /Task id: api/);
});

test("deepseek executor rejects a missing API key", () => {
  assert.throws(() => createDeepSeekExecutor({ apiKey: "", fetchImpl: async () => okResponse("{}") }), /DEEPSEEK_API_KEY/);
});

test("deepseek executor rejects a non-function fetch", () => {
  assert.throws(() => createDeepSeekExecutor({ apiKey: "k", fetchImpl: "not-a-function" }), /fetchImpl must be a function/);
});

test("deepseek executor marks 5xx and 429 as retryable", async () => {
  const executor = createDeepSeekExecutor({ apiKey: "k", fetchImpl: async () => errorResponse(500) });
  await assert.rejects(() => executor({ task: task("api") }), (error) => error.retryable === true);
  const executor429 = createDeepSeekExecutor({ apiKey: "k", fetchImpl: async () => errorResponse(429) });
  await assert.rejects(() => executor429({ task: task("api") }), (error) => error.retryable === true);
});

test("deepseek executor rejects a non-retryable 4xx error", async () => {
  const executor = createDeepSeekExecutor({ apiKey: "k", fetchImpl: async () => errorResponse(400) });
  await assert.rejects(() => executor({ task: task("api") }), (error) => error.retryable !== true);
});

test("deepseek executor rejects malformed or traversal artifact paths", async () => {
  const executor = createDeepSeekExecutor({ apiKey: "k", fetchImpl: async () => okResponse(JSON.stringify({ artifactPath: "../escape" })) });
  await assert.rejects(() => executor({ task: task("api") }), /repository-relative/);
});

test("openai reviewer sends the task and checks to the API and returns a reviewTask result", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return okResponse(JSON.stringify({ findings: [{ severity: "MINOR", code: "nit", message: "minor style" }] }));
  };
  const reviewer = createOpenAiReviewer({ apiKey: "test-key", model: "gpt-4o", fetchImpl });
  const result = await reviewer({ task: task("api"), checks: ["test:api"] });
  assert.equal(result.taskId, "api");
  assert.equal(result.verdict, "APPROVED");
  assert.equal(result.severityCounts.MINOR, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-key");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, "gpt-4o");
  assert.match(body.messages[0].content, /Task id: api/);
});

test("openai reviewer rejects a task with BLOCKER or MAJOR findings", async () => {
  const fetchImpl = async () => okResponse(JSON.stringify({ findings: [{ severity: "MAJOR", code: "invariant", message: "violates invariant" }] }));
  const reviewer = createOpenAiReviewer({ apiKey: "k", fetchImpl });
  const result = await reviewer({ task: task("api") });
  assert.equal(result.verdict, "REJECTED");
  assert.equal(result.blocked, true);
});

test("openai reviewer rejects a missing API key", () => {
  assert.throws(() => createOpenAiReviewer({ apiKey: "", fetchImpl: async () => okResponse("{}") }), /OPENAI_API_KEY/);
});

test("openai reviewer rejects malformed findings", async () => {
  const fetchImpl = async () => okResponse(JSON.stringify({ findings: [{ severity: "INVALID", code: "x", message: "y" }] }));
  const reviewer = createOpenAiReviewer({ apiKey: "k", fetchImpl });
  await assert.rejects(() => reviewer({ task: task("api") }), /finding.severity is invalid/);
});

test("openai reviewer marks 5xx and 429 as retryable", async () => {
  const reviewer = createOpenAiReviewer({ apiKey: "k", fetchImpl: async () => errorResponse(500) });
  await assert.rejects(() => reviewer({ task: task("api") }), (error) => error.retryable === true);
});
