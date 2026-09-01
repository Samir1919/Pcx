// Real ClamAV (clamd) scanner for uploads (E19).
//
// A clamd client that speaks the `INSTREAM` protocol. When a clamd endpoint is
// configured, uploads are streamed to the running antivirus daemon and rejected
// fail-closed when the daemon reports a threat or is unreachable (the caller
// falls back to the bundled signature scanner, never to a fail-open pass).
//
// Endpoint format: `unix:/run/clamav/clamd.sock` or `host:port`.
// Scan contract matches the malware scanner port: `scan(buffer)` returns
// `{ clean, threats }`.

import net from "node:net";

const CHUNK_SIZE = 64 * 1024;

function connect(endpoint, timeout) {
  return new Promise((resolve, reject) => {
    let socket;
    if (endpoint.startsWith("unix:")) {
      socket = net.createConnection(endpoint.slice("unix:".length));
    } else {
      const separator = endpoint.lastIndexOf(":");
      const host = endpoint.slice(0, separator) || "127.0.0.1";
      const port = Number(endpoint.slice(separator + 1));
      if (!Number.isInteger(port)) throw new Error(`invalid clamd endpoint: ${endpoint}`);
      socket = net.createConnection({ host, port });
    }
    const timer = setTimeout(() => { socket.destroy(new Error("clamd timeout")); }, timeout);
    socket.once("connect", () => { clearTimeout(timer); resolve(socket); });
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let data = "";
    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
    }
    function onData(chunk) {
      data += chunk.toString("utf8");
      const index = data.indexOf("\0");
      if (index >= 0) { cleanup(); resolve(data.slice(0, index)); }
    }
    function onError(error) { cleanup(); reject(error); }
    function onEnd() { cleanup(); resolve(data); }
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
  });
}

function parseResponse(response) {
  const result = response.trim();
  if (result.endsWith("OK")) return Object.freeze({ clean: true, threats: Object.freeze([]) });
  if (result.endsWith("FOUND")) {
    const threat = result.replace(/^stream:\s*/i, "").replace(/\s+FOUND$/i, "").trim();
    return Object.freeze({ clean: false, threats: Object.freeze([threat || "unknown_threat"]) });
  }
  throw new Error(`clamd: ${result || "empty response"}`);
}

export function createClamavScanner({ endpoint, timeout = 5000 } = {}) {
  if (typeof endpoint !== "string" || endpoint.length === 0) throw new TypeError("clamd endpoint is required");
  if (!Number.isFinite(timeout) || timeout <= 0) throw new TypeError("timeout must be positive");
  return Object.freeze({
    async scan(buffer) {
      if (!Buffer.isBuffer(buffer)) return Object.freeze({ clean: false, threats: Object.freeze(["invalid_input"]) });
      const socket = await connect(endpoint, timeout);
      try {
        socket.write("zINSTREAM\0");
        for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
          const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
          const header = Buffer.alloc(4);
          header.writeUInt32BE(chunk.length, 0);
          socket.write(header);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4)); // zero-length terminator
        return parseResponse(await readResponse(socket));
      } finally {
        socket.destroy();
      }
    }
  });
}

// Fail-closed composite: try the primary (clamd) scanner first; if it throws
// (daemon unreachable), fall back to the bundled signature scanner rather than
// failing open.
export function createCompositeMalwareScanner({ primary, fallback }) {
  if (!primary || typeof primary.scan !== "function") throw new TypeError("primary scanner is required");
  if (!fallback || typeof fallback.scan !== "function") throw new TypeError("fallback scanner is required");
  return Object.freeze({
    async scan(buffer) {
      try {
        return await primary.scan(buffer);
      } catch {
        return fallback.scan(buffer);
      }
    }
  });
}

export function createClamavScannerFromEnv(env = process.env) {
  const endpoint = env.CLAMAV_ENDPOINT?.trim();
  if (!endpoint) return null;
  return createClamavScanner({ endpoint, timeout: Number(env.CLAMAV_TIMEOUT_MS) || 5000 });
}