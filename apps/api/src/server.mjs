import { createServer } from "node:http";

export function createRequestHandler({ readiness = () => ({ ok: true }) } = {}) {
  return (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    if (request.url === "/health/live") {
      response.writeHead(200).end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (request.url === "/health/ready") {
      const state = readiness();
      response.writeHead(state.ok ? 200 : 503).end(JSON.stringify({ status: state.ok ? "ready" : "not_ready" }));
      return;
    }
    response.writeHead(404).end(JSON.stringify({ error: "not_found" }));
  };
}

export function createApiServer(options = {}) {
  return createServer(createRequestHandler(options));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.API_PORT || 4000);
  createApiServer().listen(port, () => process.stdout.write(`PCX API listening on ${port}\n`));
}
