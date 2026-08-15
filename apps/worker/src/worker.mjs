export function startWorker() {
  return { status: "idle", durableTruth: "postgresql" };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.stdout.write(`${JSON.stringify(startWorker())}\n`);
}
