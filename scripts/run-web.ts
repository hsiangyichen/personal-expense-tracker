import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { registerApplicationProcess } from "../src/lib/application-lock";
import { resolveStoragePaths } from "../src/lib/storage-paths";

const [mode, ...nextArguments] = process.argv.slice(2);
if (mode !== "dev" && mode !== "start") {
  throw new Error(
    "Usage: tsx scripts/run-web.ts <dev|start> [Next.js options]",
  );
}

registerApplicationProcess(resolveStoragePaths().runtimeMarkerDirectory);

const nextExecutable = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);
const child = spawn(nextExecutable, [mode, ...nextArguments], {
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
