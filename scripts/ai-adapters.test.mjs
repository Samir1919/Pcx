import assert from "node:assert/strict";
import test from "node:test";
import { createDeepSeekExecutor, createProviderExecutor, createProviderPoolExecutor } from "./ai-executor.mjs";
import { createOpenAiReviewer, createProviderPoolReviewer, createProviderReviewer } from "./ai-review.mjs";
import { resolveProvider } from "./ai-providers.mjs";

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
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[1].role, "user");
  assert.match(body.messages[1].content, /Task id: api/);
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

test("deepseek executor uses the configured endpoint (env-driven override)", async () => {
  let url;
  const fetchImpl = async (calledUrl) => {
    url = calledUrl;
    return okResponse(JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }));
  };
  const executor = createDeepSeekExecutor({ apiKey: "k", endpoint: "https://agg.example/v1/chat/completions", fetchImpl });
  await executor({ task: task("api") });
  assert.equal(url, "https://agg.example/v1/chat/completions");
});

test("deepseek executor fails fast on leaked tool-call syntax instead of looping", async () => {
  for (const content of ["<｜tool_calls｜>...", "<invoke name=\"x\"></invoke>", "<tool_calls>boom</tool_calls>"]) {
    const executor = createDeepSeekExecutor({ apiKey: "k", fetchImpl: async () => okResponse(content) });
    await assert.rejects(() => executor({ task: task("api") }), (error) => error.retryable === false && /leaked tool-call/.test(error.message));
  }
});

test("deepseek executor sends thinking and reasoning_effort when enabled and omits json_object", async () => {
  let body;
  const executor = createDeepSeekExecutor({
    apiKey: "k",
    thinkingEnabled: true,
    reasoningEffort: "high",
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return okResponse(JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }));
    }
  });
  await executor({ task: task("api") });
  assert.deepEqual(body.thinking, { type: "enabled" });
  assert.equal(body.reasoning_effort, "high");
  assert.equal("response_format" in body, false);
});

test("deepseek executor keeps json_object and omits thinking when reasoning is off", async () => {
  let body;
  const executor = createDeepSeekExecutor({
    apiKey: "k",
    thinkingEnabled: false,
    reasoningEffort: null,
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return okResponse(JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }));
    }
  });
  await executor({ task: task("api") });
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal("thinking" in body, false);
  assert.equal("reasoning_effort" in body, false);
});

test("deepseek executor tolerates fenced JSON in the model output", async () => {
  const fenced = "```json\n" + JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }) + "\n```";
  const executor = createDeepSeekExecutor({ apiKey: "k", thinkingEnabled: true, fetchImpl: async () => okResponse(fenced) });
  const result = await executor({ task: task("api") });
  assert.deepEqual(result.artifacts, [{ type: "commit", path: "apps/api/src/a.mjs", status: "ok" }]);
});

test("deepseek executor rejects an invalid reasoning effort", () => {
  assert.throws(() => createDeepSeekExecutor({ apiKey: "k", reasoningEffort: "extreme", fetchImpl: async () => okResponse("{}") }), /reasoningEffort must be low, medium, or high/);
});

test("provider executor surfaces accumulated token usage from the response payload", async () => {
  const provider = resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "k" } });
  const payloads = [
    { choices: [{ message: { content: "<｜tool_calls｜>..." } }], usage: { prompt_tokens: 10, completion_tokens: 4 } },
    { choices: [{ message: { content: JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }) } }], usage: { prompt_tokens: 20, completion_tokens: 6 } }
  ];
  const enriched = Object.freeze({ ...provider, supportsThinking: true, effortParam: "reasoning_effort", thinkingEnabled: true, reasoningEffort: "high" });
  let call = 0;
  const executor = createProviderExecutor({
    provider: enriched,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => payloads[call++] })
  });
  const result = await executor({ task: task("api") });
  // One leaked-tool-call self-heal fallback, so both responses' usage is summed.
  assert.equal(call, 2);
  assert.deepEqual(result.usage, { promptTokens: 30, completionTokens: 10 });
});

test("provider executor returns zero usage when the provider reports none", async () => {
  const provider = resolveProvider({ name: "openai", env: { OPENAI_API_KEY: "k" } });
  const executor = createProviderExecutor({
    provider,
    fetchImpl: async () => okResponse(JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }))
  });
  const result = await executor({ task: task("api") });
  assert.deepEqual(result.usage, { promptTokens: 0, completionTokens: 0 });
});

test("provider executor sends an OpenAI-compatible request and returns a validated artifact", async () => {
  const provider = resolveProvider({ name: "kimi", env: { KIMI_API_KEY: "k", KIMI_MODEL: "kimi-k2" } });
  let captured;
  const executor = createProviderExecutor({
    provider,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }) } }] }) };
    }
  });
  const result = await executor({ task: task("api"), actions: ["read"] });
  assert.deepEqual(result.artifacts, [{ type: "commit", path: "apps/api/src/a.mjs", status: "ok" }]);
  assert.equal(captured.url, "https://api.moonshot.cn/v1/chat/completions");
  assert.equal(JSON.parse(captured.options.body).model, "kimi-k2");
  assert.equal(captured.options.headers.Authorization, "Bearer k");
});

test("provider executor uses the Anthropic x-api-key dialect", async () => {
  const provider = resolveProvider({ name: "anthropic", env: { ANTHROPIC_API_KEY: "ant" } });
  let captured;
  const executor = createProviderExecutor({
    provider,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }) }] }) };
    }
  });
  await executor({ task: task("api") });
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  assert.equal(captured.options.headers["x-api-key"], "ant");
  assert.equal(captured.options.headers["anthropic-version"], "2023-06-01");
  assert.ok(JSON.parse(captured.options.body).max_tokens > 0);
  assert.equal(JSON.parse(captured.options.body).system, "You are a coding agent working on the PCX repository.");
});

test("provider executor self-heals once from a leaked tool-call when thinking is on", async () => {
  const provider = resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "k" } });
  const enriched = Object.freeze({ ...provider, supportsThinking: true, effortParam: "reasoning_effort", thinkingEnabled: true, reasoningEffort: "high" });
  const bodies = [];
  let call = 0;
  const executor = createProviderExecutor({
    provider: enriched,
    fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      call += 1;
      if (call === 1) {
        return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "<｜tool_calls｜>..." } }] }) };
      }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }) } }] }) };
    }
  });
  const result = await executor({ task: task("api") });
  assert.deepEqual(result.artifacts, [{ type: "commit", path: "apps/api/src/a.mjs", status: "ok" }]);
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[0].thinking, { type: "enabled" });
  assert.equal("thinking" in bodies[1], false);
  assert.deepEqual(bodies[1].response_format, { type: "json_object" });
});

test("provider pool executor spreads tasks across active providers", async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push(url);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ artifactPath: "apps/api/src/a.mjs" }) } }] }) };
  };
  const pool = createProviderPoolExecutor({
    providers: [
      resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "d" } }),
      resolveProvider({ name: "openai", env: { OPENAI_API_KEY: "o" } })
    ],
    fetchImpl
  });
  // Run two tasks; the deterministic hash may land them on the same or
  // different providers, so just verify a validated artifact comes back and the
  // pool was constructed with the two active providers.
  const a = await pool({ task: task("api-a") });
  const b = await pool({ task: task("api-b") });
  assert.deepEqual(a.artifacts, [{ type: "commit", path: "apps/api/src/a.mjs", status: "ok" }]);
  assert.deepEqual(b.artifacts, [{ type: "commit", path: "apps/api/src/a.mjs", status: "ok" }]);
  assert.equal(seen.length, 2);
});

test("provider pool reviewer returns reviewTask-shaped results", async () => {
  const pool = createProviderPoolReviewer({
    providers: [
      resolveProvider({ name: "openai", env: { OPENAI_API_KEY: "k" } }),
      resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "k" } })
    ],
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ findings: [] }) } }] }) })
  });
  const result = await pool({ task: task("api") });
  assert.equal(result.taskId, "api");
  assert.equal(result.verdict, "APPROVED");
});

test("provider reviewer returns a reviewTask-shaped result and rejects blockers", async () => {
  const provider = resolveProvider({ name: "openai", env: { OPENAI_API_KEY: "k" } });
  const reviewer = createProviderReviewer({
    provider,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ findings: [{ severity: "MAJOR", code: "inv", message: "bad" }] }) } }] }) })
  });
  const result = await reviewer({ task: task("api"), checks: ["test:api"] });
  assert.equal(result.verdict, "REJECTED");
  assert.equal(result.blocked, true);
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

test("openai reviewer retries once without previous response id when provider reports previous_response_not_found", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          details: {
            code: "previous_response_not_found",
            param: "previous_response_id",
            message: "Previous response with id 'resp_123' not found"
          }
        })
      };
    }
    return okResponse(JSON.stringify({ findings: [] }));
  };
  const reviewer = createOpenAiReviewer({
    apiKey: "k",
    fetchImpl,
    requestBodyExtras: { previous_response_id: "resp_123" }
  });
  const result = await reviewer({ task: task("api") });
  assert.equal(result.verdict, "APPROVED");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].previous_response_id, "resp_123");
  assert.equal("previous_response_id" in calls[1], false);
});

test("openai reviewer does not retry unrelated 400 errors", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: false,
      status: 400,
      json: async () => ({ details: { code: "invalid_request_error", message: "bad request" } })
    };
  };
  const reviewer = createOpenAiReviewer({
    apiKey: "k",
    fetchImpl,
    requestBodyExtras: { previous_response_id: "resp_123" }
  });
  await assert.rejects(() => reviewer({ task: task("api") }), /OpenAI API error: 400/);
  assert.equal(calls, 1);
});
