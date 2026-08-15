# PCX

PCX is a verified used-tech recommerce platform for Bangladesh. The repository begins as a modular monolith with separate customer web, operations UI, API, and worker boundaries.

## E0 quick start

1. Install Node.js 22 and Docker.
2. Copy `.env.example` to `.env` and use local-only values.
3. Run `npm install`.
4. Run `npm run verify:e0` and `npm test`.
5. Run `docker compose -f infra/docker-compose.yml up -d` for local services.
6. Run `npm run dev:api`; check `/health/live` and `/health/ready`.

No production deployment or credential configuration is included in E0.

## Use with any coding agent

Open the repository root in VS Code or another editor and tell the agent to start with `AGENTS.md`. Tool-specific adapters for common agents are intentionally thin; all agents share the same Project Brain, approved specifications, task template, verification commands, and handoff format.

Start a new agent session with `docs/agentic/START_PROMPT.md`. See `docs/agentic/PORTABLE_AGENT_WORKFLOW.md` for the complete portable workflow.
