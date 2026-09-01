import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { createClamavScanner, createCompositeMalwareScanner, createClamavScannerFromEnv } from "../src/modules/media/clamav-scanner.mjs";

// A minimal in-process clamd that speaks just enough of the INSTREAM protocol
// to exercise the client: reads the length-prefixed chunks, then replies with a
// fixed verdict for the test.
function mockClamd(verdict) {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.once("data", () => {
        // Drain whatever chunks arrive, then reply with the verdict.
        socket.on("data", () => {});
        setTimeout(() => {
          socket.write(`${verdict}\0`);
          socket.end();
        }, 5);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("clamd scanner reports clean on stream OK", async () => {
  const server = await mockClamd("stream: OK");
  const scanner = createClamavScanner({ endpoint: `127.0.0.1:${server.address().port}` });
  const result = await scanner.scan(Buffer.from("benign image bytes"));
  assert.deepEqual(result, { clean: true, threats: [] });
  server.close();
});

test("clamd scanner reports the threat on stream FOUND", async () => {
  const server = await mockClamd("stream: Eicar-Test-Signature FOUND");
  const scanner = createClamavScanner({ endpoint: `127.0.0.1:${server.address().port}` });
  const result = await scanner.scan(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"));
  assert.equal(result.clean, false);
  assert.deepEqual(result.threats, ["Eicar-Test-Signature"]);
  server.close();
});

test("clamd scanner throws when the daemon is unreachable", async () => {
  const scanner = createClamavScanner({ endpoint: "127.0.0.1:1", timeout: 200 });
  await assert.rejects(() => scanner.scan(Buffer.from("x")));
});

test("composite scanner falls back to the signature scanner when clamd fails", async () => {
  const fallback = { async scan(buffer) { return buffer.includes(Buffer.from("MZ")) ? { clean: false, threats: ["DOS/PE executable"] } : { clean: true, threats: [] }; } };
  const primary = { async scan() { throw new Error("clamd down"); } };
  const scanner = createCompositeMalwareScanner({ primary, fallback });
  assert.deepEqual(await scanner.scan(Buffer.from("clean")), { clean: true, threats: [] });
  assert.deepEqual(await scanner.scan(Buffer.from("MZ")), { clean: false, threats: ["DOS/PE executable"] });
});

test("composite scanner prefers clamd when it answers", async () => {
  const fallback = { async scan() { return { clean: true, threats: [] }; } };
  const primary = { async scan() { return { clean: false, threats: ["ClamAV-Test-File"] }; } };
  const scanner = createCompositeMalwareScanner({ primary, fallback });
  assert.deepEqual(await scanner.scan(Buffer.from("x")), { clean: false, threats: ["ClamAV-Test-File"] });
});

test("clamd scanner from env is null without CLAMAV_ENDPOINT and set otherwise", () => {
  assert.equal(createClamavScannerFromEnv({}), null);
  const scanner = createClamavScannerFromEnv({ CLAMAV_ENDPOINT: "unix:/run/clamav/clamd.sock" });
  assert.equal(typeof scanner.scan, "function");
});