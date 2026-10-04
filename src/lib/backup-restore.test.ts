import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApplicationRunningError } from "@/lib/application-lock";
import { createDatabaseBackup } from "@/lib/backup-service";
import {
  DatabaseValidationError,
  inspectDatabaseFile,
} from "@/lib/database-inspection";
import { RestoreError, restoreDatabaseBackup } from "@/lib/restore-service";
import type { StoragePaths } from "@/lib/storage-paths";
import { prepareTestDatabase } from "../../test/prepare-database";

const scratchRoot =
  process.env.KIROCREW_SCRATCH ?? path.resolve("data/test-scratch");
let suiteDirectory: string;
let templatePath: string;

beforeAll(async () => {
  await mkdir(scratchRoot, { recursive: true });
  suiteDirectory = await mkdtemp(path.join(scratchRoot, "backup-restore-"));
  templatePath = path.join(suiteDirectory, "template.db");
  prepareTestDatabase(`file:${templatePath}`);
});

afterAll(async () => {
  await rm(suiteDirectory, { recursive: true, force: true });
});

describe("database backup", () => {
  it("creates a validated SQLite backup with restricted permissions", async () => {
    const paths = await createCasePaths("backup");
    const result = await createDatabaseBackup({
      now: new Date("2026-10-04T09:00:00Z"),
      paths,
    });
    const inspection = await inspectDatabaseFile(result.path);

    expect(result.path.startsWith(paths.backupDirectory)).toBe(true);
    expect(result.createdAt).toBe("2026-10-04T09:00:00.000Z");
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(inspection.counts.categories).toBeGreaterThanOrEqual(8);
  });
});

describe("database restore", () => {
  it("restores a validated backup and preserves a safety copy", async () => {
    const paths = await createCasePaths("success");
    const backupPath = await createDatabaseWithExtraCategories(
      paths,
      "selected.db",
      2,
    );
    await addCategories(paths.databasePath, 1, "active");
    const expected = await inspectDatabaseFile(backupPath);

    const result = await restoreDatabaseBackup(backupPath, {
      paths,
      beforeReplace: async () => {
        await writeFile(`${paths.databasePath}-wal`, "stale sidecar");
        await writeFile(`${paths.databasePath}-shm`, "stale sidecar");
      },
    });
    const restored = await inspectDatabaseFile(paths.databasePath);
    const safety = await inspectDatabaseFile(result.safetyCopyPath);

    expect(restored.counts).toEqual(expected.counts);
    expect(safety.counts.categories).toBe(9);
    expect(result.counts).toEqual(expected.counts);
    await expect(readFile(`${paths.databasePath}-wal`)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(`${paths.databasePath}-shm`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects malformed and incompatible backup files before replacement", async () => {
    const malformedPaths = await createCasePaths("malformed");
    const malformedPath = path.join(malformedPaths.backupDirectory, "bad.db");
    await mkdir(malformedPaths.backupDirectory, { recursive: true });
    await writeFile(malformedPath, "not sqlite");
    const originalBytes = await readFile(malformedPaths.databasePath);

    await expect(
      restoreDatabaseBackup(malformedPath, { paths: malformedPaths }),
    ).rejects.toBeInstanceOf(DatabaseValidationError);
    await expect(readFile(malformedPaths.databasePath)).resolves.toEqual(
      originalBytes,
    );

    const incompatiblePaths = await createCasePaths("incompatible");
    const incompatiblePath = path.join(
      incompatiblePaths.backupDirectory,
      "incompatible.db",
    );
    await createIncompatibleDatabase(incompatiblePath);
    await expect(
      restoreDatabaseBackup(incompatiblePath, { paths: incompatiblePaths }),
    ).rejects.toThrow("incompatible");
  });

  it("refuses to restore while the application marker is active", async () => {
    const paths = await createCasePaths("active");
    const backupPath = await createDatabaseWithExtraCategories(
      paths,
      "selected.db",
      1,
    );
    await mkdir(paths.runtimeMarkerDirectory, { recursive: true });
    await writeFile(
      path.join(paths.runtimeMarkerDirectory, `${process.pid}.json`),
      JSON.stringify({ pid: process.pid }),
    );

    await expect(
      restoreDatabaseBackup(backupPath, { paths }),
    ).rejects.toBeInstanceOf(ApplicationRunningError);
  });

  it("leaves the active database unchanged when replacement is interrupted", async () => {
    const paths = await createCasePaths("interrupted");
    const backupPath = await createDatabaseWithExtraCategories(
      paths,
      "selected.db",
      2,
    );
    await addCategories(paths.databasePath, 1, "active");
    const original = await inspectDatabaseFile(paths.databasePath);

    await expect(
      restoreDatabaseBackup(backupPath, {
        paths,
        beforeReplace: () => {
          throw new Error("simulated interruption");
        },
      }),
    ).rejects.toThrow("before database replacement");

    await expect(
      inspectDatabaseFile(paths.databasePath),
    ).resolves.toMatchObject({ counts: original.counts });
  });

  it("rolls back to the safety copy when restored-count verification fails", async () => {
    const paths = await createCasePaths("rollback");
    const backupPath = await createDatabaseWithExtraCategories(
      paths,
      "selected.db",
      2,
    );
    await addCategories(paths.databasePath, 1, "active");
    const original = await inspectDatabaseFile(paths.databasePath);

    await expect(
      restoreDatabaseBackup(backupPath, {
        paths,
        verifyRestored: () => false,
      }),
    ).rejects.toBeInstanceOf(RestoreError);

    const rolledBack = await inspectDatabaseFile(paths.databasePath);
    expect(rolledBack.counts).toEqual(original.counts);
  });
});

async function createCasePaths(label: string): Promise<StoragePaths> {
  const projectRoot = path.join(
    suiteDirectory,
    `${label}-${randomUUID().slice(0, 8)}`,
  );
  const dataDirectory = path.join(projectRoot, "data");
  const databasePath = path.join(dataDirectory, "expense-tracker.db");
  await mkdir(dataDirectory, { recursive: true });
  await copyFile(templatePath, databasePath);

  return {
    projectRoot,
    dataDirectory,
    databasePath,
    backupDirectory: path.join(projectRoot, "backups"),
    runtimeMarkerDirectory: `${databasePath}-app-running`,
  };
}

async function createDatabaseWithExtraCategories(
  paths: StoragePaths,
  fileName: string,
  count: number,
) {
  await mkdir(paths.backupDirectory, { recursive: true });
  const databasePath = path.join(paths.backupDirectory, fileName);
  await copyFile(templatePath, databasePath);
  await addCategories(databasePath, count, "backup");
  return databasePath;
}

async function addCategories(
  databasePath: string,
  count: number,
  prefix: string,
) {
  const client = clientFor(databasePath);
  try {
    for (let index = 0; index < count; index += 1) {
      const marker = randomUUID();
      await client.category.create({
        data: {
          name: `${prefix}-${marker}`,
          normalizedName: `${prefix}-${marker}`,
          color: "#123456",
        },
      });
    }
  } finally {
    await client.$disconnect();
  }
}

async function createIncompatibleDatabase(databasePath: string) {
  await mkdir(path.dirname(databasePath), { recursive: true });
  const client = clientFor(databasePath);
  try {
    await client.$executeRawUnsafe(
      "CREATE TABLE example (id TEXT NOT NULL PRIMARY KEY)",
    );
  } finally {
    await client.$disconnect();
  }
}

function clientFor(databasePath: string) {
  return new PrismaClient({
    datasources: { db: { url: `file:${databasePath}` } },
  });
}
