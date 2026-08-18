import assert from "node:assert/strict";
import test from "node:test";
import {
  findPidsByPattern,
  findPidsOnPort,
  gracefulKill,
  parsePidLines,
  stopHostProcesses,
  stopInfraContainers,
  uniqueIds
} from "./dev-down.mjs";

test("uniqueIds dedupes and drops empty values", () => {
  assert.deepEqual(uniqueIds(["1", "2", "1", "", "  ", null, undefined, "3"]), ["1", "2", "3"]);
  assert.deepEqual(uniqueIds([]), []);
});

test("parsePidLines returns only numeric lines", () => {
  assert.deepEqual(parsePidLines("123\n456\n\nnotapid\n789\n"), ["123", "456", "789"]);
  assert.deepEqual(parsePidLines(""), []);
  assert.deepEqual(parsePidLines("  123  \n 456 "), ["123", "456"]);
});

test("findPidsOnPort parses lsof numeric output", async () => {
  const run = async () => ({ stdout: "111\n222\n" });
  assert.deepEqual(await findPidsOnPort(4000, run), ["111", "222"]);
});

test("findPidsOnPort returns empty list when lsof reports nothing listening", async () => {
  const run = async () => {
    const error = new Error("nothing");
    error.code = 1;
    throw error;
  };
  assert.deepEqual(await findPidsOnPort(4000, run), []);
});

test("findPidsByPattern parses pgrep numeric output and tolerates misses", async () => {
  assert.deepEqual(await findPidsByPattern("dev.mjs", async () => ({ stdout: "333\n444\n" })), ["333", "444"]);
  assert.deepEqual(await findPidsByPattern("dev.mjs", async () => { throw new Error("no match"); }), []);
});

test("gracefulKill sends SIGINT then SIGKILL fallback when still alive", async () => {
  const calls = [];
  const alive = new Set([100]);
  const kill = (pid, signal) => {
    calls.push([pid, signal]);
    if (signal === "SIGKILL") alive.delete(pid);
    if (signal === 0 && !alive.has(pid)) {
      const error = new Error("gone");
      error.code = "ESRCH";
      throw error;
    }
  };
  const wait = async () => { };
  assert.equal(await gracefulKill({ pid: 100, kill, wait }), true);
  assert.deepEqual(calls, [[100, "SIGINT"], [100, 0], [100, "SIGKILL"]]);
});

test("gracefulKill treats an already-dead process as gone without force kill", async () => {
  const calls = [];
  const kill = (pid, signal) => {
    calls.push([pid, signal]);
    if (signal === 0) {
      const error = new Error("gone");
      error.code = "ESRCH";
      throw error;
    }
  };
  const wait = async () => { };
  assert.equal(await gracefulKill({ pid: 100, kill, wait }), true);
  assert.deepEqual(calls, [[100, "SIGINT"], [100, 0]]);
});

test("gracefulKill treats a missing process as gone", async () => {
  const kill = () => {
    const error = new Error("already gone");
    error.code = "ESRCH";
    throw error;
  };
  assert.equal(await gracefulKill({ pid: 100, kill }), true);
});

test("stopHostProcesses excludes the configured PID and reports stopped PIDs", async () => {
  const killed = [];
  const groups = {
    api: ["42", "43"],
    orchestrator: ["43", "999"]
  };
  const report = await stopHostProcesses({
    groups,
    excludePid: 999,
    killProcess: async (pid) => {
      killed.push(pid);
      return true;
    }
  });
  // Each group is signalled independently, so a PID present in multiple groups
  // is signalled once per group. Re-signalling an already-dead PID is harmless.
  assert.deepEqual(killed, [42, 43, 43]);
  assert.deepEqual(report.api.pids, [42, 43]);
  assert.deepEqual(report.orchestrator.pids, [43]);
});

test("stopInfraContainers runs compose down by default", async () => {
  const calls = [];
  const runCommand = async (command, args) => calls.push([command, args]);
  assert.deepEqual(await stopInfraContainers({ runCommand }), { action: "down" });
  assert.deepEqual(calls, [["docker", ["compose", "-f", "infra/docker-compose.yml", "down"]]]);
});

test("stopInfraContainers runs compose stop with --stop mode", async () => {
  const calls = [];
  const runCommand = async (command, args) => calls.push([command, args]);
  assert.deepEqual(await stopInfraContainers({ mode: "stop", runCommand }), { action: "stop" });
  assert.deepEqual(calls, [["docker", ["compose", "-f", "infra/docker-compose.yml", "stop"]]]);
});
