# Automatic Session Bootstrap for Any Coding Agent

Tool adapters at the repository root route supported coding agents here automatically. If an agent does not support repository instruction discovery, copy the block below into its first message.

```text
You are working on the PCX repository. Treat repository files as the durable source of truth and do not rely on prior chat history.

Always communicate with the human in Bengali (বাংলা) — final summaries, explanations, questions, status updates, and every user-facing message. Code, comments, identifiers, commit messages, documentation, and file contents stay in English.

First read AGENTS.md completely, then docs/brain/README.md and docs/agentic/PORTABLE_AGENT_WORKFLOW.md. Inspect the current branch, git status, relevant accepted ADRs, active task specification, affected code, and tests.

If the task uses multiple agents, read docs/agentic/MULTI_AGENT_SYSTEM.md and assign non-overlapping bounded tasks. The orchestrator remains responsible for integration, review, verification, and hard-stop enforcement.

For this task: <WRITE THE BOUNDED OBJECTIVE HERE>

Before coding, state the relevant source-of-truth documents, scope, non-scope, hard stops, acceptance criteria, security implications, and test plan. Report conflicts instead of inventing business policy. Implement the smallest coherent slice, preserve PCX domain invariants, run relevant checks plus npm run verify before completion, self-review the diff, and produce a handoff using docs/agentic/HANDOFF_TEMPLATE.md.

If the human asks you to continue across dependency-ready work, treat each verified commit/handoff as a checkpoint and immediately start the next bounded slice. Do not return control solely because one slice completed. Stop only for completion of the requested terminal outcome, an explicit human limit/stop, a hard stop, a genuine blocker, or a required material human decision.

Do not deploy to production, perform destructive migrations, change credentials/payment destinations, weaken security/tests, or change core invariants without explicit human approval and the required ADR.
```
