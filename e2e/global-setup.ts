import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function prepareDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error(
      "Playwright requires an isolated file-based SQLite database.",
    );
  }

  const databasePath = fileURLToPath(databaseUrl);
  mkdirSync(path.dirname(databasePath), { recursive: true });

  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }

  const prismaExecutable = path.resolve(
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma",
  );
  const options = {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit" as const,
  };

  execFileSync(prismaExecutable, ["migrate", "deploy"], options);
  execFileSync(prismaExecutable, ["db", "seed"], options);
}

prepareDatabase();
