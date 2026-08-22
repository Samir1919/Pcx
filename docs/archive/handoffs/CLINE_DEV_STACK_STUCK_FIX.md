# Dev stack keeps getting "stuck" — root cause + fix

## Evidence gathered

- `ps aux` right now: **no** `node scripts/dev.mjs`, `next dev`, or `PCX API` process is
  running. `lsof` shows only Docker's Postgres container and an unrelated
  ControlCenter port listening — ports 3000/3001/4000 are free. So the stack is not
  "hung", it is **not running at all**.
- `/tmp/pcx-dev.log` from the last real run shows a completely healthy session:
  infra containers up, migrations applied, api/web/admin/worker all started,
  requests served fine for a while — then the log ends with:
  ```
  [dev] stopping all child processes…
  [web] [?25h
  [admin] [?25h
  ```
  Critically, there is **no** preceding line like
  `[dev] a child process exited (code=..., signal=...); stopping the rest.`
  Looking at `scripts/dev.mjs`, that message is only skipped when `shutdown()`
  was triggered by the process itself receiving `SIGINT`/`SIGTERM` directly
  (see `process.on("SIGINT", shutdown)` / `process.on("SIGTERM", shutdown)` in
  scripts/dev.mjs:146-147) — not by a crash in api/web/admin/worker. So nothing
  in the app crashed; something sent the whole `node scripts/dev.mjs` process a
  stop signal.
- Both times the follow-up command was submitted through Cline it shows up as
  **"Skipped"** in the transcript — i.e. Cline's own permission/approval layer
  never actually let the shell command run at all. That is a second, separate
  failure mode: the perceived "stuck" is sometimes just "the background-start
  command was never approved/executed."
- Also present in the log (not the cause of the stop, but worth fixing since
  it's from the files currently modified in `git status`):
  `apps/web/app/passport/PassportInfoModal.js` renders an `<h2>` inside a `<p>`
  (`storefront` hero → `PassportInfoModal` dialog), which React flags as
  "cannot be a descendant of `<p>`" → hydration warning on every `/storefront`
  render. Harmless to the shutdown issue, but worth cleaning up while touching
  that file.

## Root causes (two independent problems)

1. **The orchestrator process itself is being sent SIGINT/SIGTERM**, most
   likely because `nohup`/`setsid` were applied to the *outer* pipeline but the
   terminal/pty that Cline spawned for the command was torn down before the
   process was fully detached into its own session — or a later Cline command
   in the same terminal (e.g. re-running `npm run dev`) sent Ctrl+C-equivalent
   to the existing job first. `nohup` only ignores `SIGHUP`; it does **not**
   ignore `SIGINT`/`SIGTERM`, and `scripts/dev.mjs` explicitly listens for and
   honors both.
2. **Cline is skipping the command instead of running it.** That's a
   permission/config issue in Cline, not in the repo — no log is produced
   because nothing executed.

## Fix

### A. Start the stack so it actually survives the calling shell

Use `setsid` **and** explicitly ignore SIGHUP/SIGINT for the whole pipeline,
then `disown` it, then verify with `ps`/`curl` instead of trusting the "started
pid" echo:

```bash
cd /Users/samir/Desktop/Pcx
setsid nohup npm run dev > /tmp/pcx-dev.log 2>&1 < /dev/null &
disown
sleep 8
ps -p $! > /dev/null && echo "process tree alive" || echo "DIED — check /tmp/pcx-dev.log"
tail -n 40 /tmp/pcx-dev.log
curl -sS -o /dev/null -w "web:%{http_code}\n" http://localhost:3000
curl -sS -o /dev/null -w "admin:%{http_code}\n" http://localhost:3001
curl -sS -o /dev/null -w "api:%{http_code}\n" http://localhost:4000
```

If it still dies right after start, the next run should also capture whether a
signal killed it:

```bash
grep -n "stopping all child processes\|a child process exited" /tmp/pcx-dev.log
```

- If you see `a child process exited (code=..., signal=...)` — one of
  api/web/admin/worker actually crashed; the code/signal shown there is the
  real error, go find *that* stack trace higher up in the log.
- If you see only `[dev] stopping all child processes…` with nothing before
  it — something external sent SIGINT/SIGTERM to the top-level process. Check
  whether another `npm run dev` / `pkill node` / VS Code task is running
  concurrently and killing it.

### B. Make sure the command is actually executed, not skipped

Before touching the code, check Cline's approval settings — the two prior
attempts never ran (`Skipped` in the transcript). Confirm whether:
- Cline is in a mode that requires manual approval for every shell command,
  and the approval prompt is timing out/auto-skipping instead of waiting.
- Cline has a command-safety rule that flags `nohup`/`setsid`/`&` as
  needing extra confirmation, and that confirmation is being auto-denied.

Run the exact same command directly in a normal Terminal.app window (bypassing
Cline entirely) to confirm the dev stack itself starts and survives:

```bash
cd /Users/samir/Desktop/Pcx
setsid nohup npm run dev > /tmp/pcx-dev.log 2>&1 < /dev/null &
disown
```

If it stays up when run manually but Cline keeps "Skipping" it, the bug is in
Cline's permission handling, not in this repo — fix/adjust Cline's
auto-approve rules for background shell commands.

### C. (Unrelated, low-priority) fix the invalid HTML nesting

In `apps/web/app/passport/PassportInfoModal.js`, the modal's `<h2>` title ends
up nested inside a `<p>` from `apps/web/app/storefront/workspace.js`'s hero
markup. Render the modal trigger/dialog outside the `<p>` (e.g. move the
`<PassportInfoModal>` usage to be a sibling of the `<p>` rather than inside
it), so React doesn't emit the "cannot be a descendant of `<p>`"
hydration-error warning on every `/storefront` page load.
