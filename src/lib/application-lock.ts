import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const globalForMarkers = globalThis as unknown as {
  registeredApplicationMarkers?: Set<string>;
};
const registeredMarkers =
  globalForMarkers.registeredApplicationMarkers ?? new Set<string>();
globalForMarkers.registeredApplicationMarkers = registeredMarkers;

export class ApplicationRunningError extends Error {
  constructor() {
    super("Stop the web application before restoring the database.");
    this.name = "ApplicationRunningError";
  }
}

export function registerApplicationProcess(markerDirectory: string) {
  if (registeredMarkers.has(markerDirectory)) return;

  mkdirSync(markerDirectory, { recursive: true, mode: 0o700 });
  const markerPath = path.join(markerDirectory, `${process.pid}.json`);
  writeFileSync(
    markerPath,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    { mode: 0o600 },
  );
  registeredMarkers.add(markerDirectory);

  process.once("exit", () => {
    rmSync(markerPath, { force: true });
  });
}

export async function assertApplicationStopped(markerDirectory: string) {
  const entries = await readdir(markerDirectory).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );

  for (const entry of entries) {
    const markerPath = path.join(markerDirectory, entry);
    const marker = await readMarker(markerPath);
    if (marker && isProcessRunning(marker.pid)) {
      throw new ApplicationRunningError();
    }
    await rm(markerPath, { force: true });
  }
}

async function readMarker(markerPath: string) {
  try {
    const value: unknown = JSON.parse(await readFile(markerPath, "utf8"));
    if (
      typeof value === "object" &&
      value !== null &&
      "pid" in value &&
      typeof value.pid === "number" &&
      Number.isInteger(value.pid) &&
      value.pid > 0
    ) {
      return { pid: value.pid };
    }
  } catch {
    return null;
  }
  return null;
}

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
