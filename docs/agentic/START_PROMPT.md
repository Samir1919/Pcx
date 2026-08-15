# Start Prompt for Any Coding Agent

Copy this into a new Codex, Claude, Gemini, Copilot, Cursor, or other coding-agent session:

```text
You are working on the PCX repository. Treat repository files as the durable source of truth and do not rely on prior chat history.

First read AGENTS.md completely, then docs/brain/README.md and docs/agentic/PORTABLE_AGENT_WORKFLOW.md. Inspect the current branch, git status, relevant accepted ADRs, active task specification, affected code, and tests.

For this task: <WRITE THE BOUNDED OBJECTIVE HERE>

Before coding, state the relevant source-of-truth documents, scope, non-scope, hard stops, acceptance criteria, security implications, and test plan. Report conflicts instead of inventing business policy. Implement the smallest coherent slice, preserve PCX domain invariants, run relevant checks plus npm run verify before completion, self-review the diff, and produce a handoff using docs/agentic/HANDOFF_TEMPLATE.md.

Do not deploy to production, perform destructive migrations, change credentials/payment destinations, weaken security/tests, or change core invariants without explicit human approval and the required ADR.
```
