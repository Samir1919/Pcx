# Diagnosis: cline + deepseek-v4-pro stuck on tool calls

সংক্ষেপে (bn): deepseek-v4-pro মডেল tool call করার সময় নিজের internal special-token format ব্যবহার করছে, যা cline-এর harness parse করতে পারছে না। ফলে tool call টা কখনো execute হয় না, agent ভাবে সে call করেছে কিন্তু কোনো result ফেরত আসে না — loop আটকে যায়। নিচে root cause এবং fix option।

- Status: Blocked (diagnosis only, not fixed)
- Observed in: cline session running model `deepseek-v4-pro`
- Date: 2026-08-18

## Symptom

The agent's own transcript shows it emitting a tool call as:

```
<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="plan_mode_respond">
<｜｜DSML｜｜parameter name="response" string="true">...</｜｜DSML｜｜parameter>
<｜｜DSML｜｜parameter name="task_progress" string="true">...</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>
```

followed by the model's own admission: *"আমি cause খুঁজে পেয়েছি: আমি ভুল টুল-কল format ব্যবহার করছিলাম (`<invoke>` wrapper), তাই কোনো tool আসলে register-ই হয়নি।"* — i.e. the model itself detected the malformed call, but then repeated the same broken pattern on the next attempt.

## Root cause

`｜` here is the fullwidth vertical bar (U+FF5C) that DeepSeek's chat template uses to build its own reserved special tokens (the family that normally renders as things like `<｜tool▁calls▁begin｜>`, `<｜tool▁call▁begin｜>`, etc., depending on template version). "DSML" is not a real tag name — it is leaked/garbled special-token text that the inference layer failed to strip or translate.

This happens when the model-serving path does not fully implement **native function/tool calling** for this model+template combination:

1. The request is sent as a plain chat/completion call (no `tools=[...]` schema wired through, or the provider/proxy silently drops it).
2. DeepSeek's template still tries to emit its built-in tool-call syntax as part of the assistant text (because that's what it was fine-tuned to do when it "wants" to call a tool).
3. Nothing on the client side (cline) parses that raw special-token text back into a structured tool call — cline is expecting either OpenAI-style `tool_calls` JSON on the response object, or (in prompted/XML mode) a specific plain-text tag format it knows how to regex-match.
4. Neither matches, so cline treats the whole thing as inert assistant text. No tool ever runs, no tool result is appended, and the model — seeing no result — just tries again next turn, regenerating the same broken tags. That's the stuck loop.

This is a **provider/harness wiring problem**, not a logic bug in the task the agent was doing (Catalog pagination work, per the task_progress list in the transcript).

## Fix options (ordered by effort)

1. **Switch tool-calling mode in cline to match how this endpoint actually serves the model.**
   - If cline is configured for "native" function calling for this model, but the API endpoint (whatever OpenAI-compatible proxy/router serves `deepseek-v4-pro`) doesn't actually implement tool-call translation, switch cline to its prompted/XML tool-calling mode instead, and make sure cline's system prompt tells the model to emit *cline's* tag format (e.g. `<tool_name><param>value</param></tool_name>`), not DeepSeek's own reserved tokens.
   - Conversely, if cline is in XML/prompted mode but the endpoint *does* support real `tools=[...]` function calling for this model, switch cline to native mode so the server does the parsing and returns clean `tool_calls` JSON instead of raw text.

2. **Check/replace the model endpoint.** Many DeepSeek aggregator endpoints (varies by which provider is fronting `deepseek-v4-pro`) only support tool calling correctly on specific route variants (e.g. a "-chat" vs "-reasoner"/"-code" variant, or only via a particular API version). If the current endpoint doesn't advertise `tools` support, point cline at one that does, or downgrade to a variant with confirmed tool-calling support.

3. **Add a stop-sequence guard as a stopgap.** If the endpoint truly cannot do native tool calling, add stop sequences for the leaking special tokens (`<｜`, `｜>`) so the model can't emit them, and rely purely on prompted/XML mode with clear few-shot examples of the exact tag format cline expects.

4. **Verify by dry-run.** After changing the setting, give the agent a single trivial tool call (e.g. list a directory) and inspect the raw transcript, not just cline's rendered UI, to confirm the tool call arrives as valid structured JSON or valid XML tags — not as `｜`-delimited text — before letting it resume the Catalog pagination work.

## Next safe action once unblocked

Resume the in-progress task noted in the stuck transcript: Catalog "Product models" pagination (523 models, currently truncated at 50) — implement cursor pagination in the catalog UI/API, add/update tests, run `npm run verify`, then write a handoff per `docs/agentic/HANDOFF_TEMPLATE.md`.

## Blockers requiring human decision

Which cline tool-calling mode (native vs prompted/XML) and which concrete `deepseek-v4-pro` endpoint/provider is configured — this diagnosis can't fix from inside this repo since it's a cline app-level setting, not a project file.
