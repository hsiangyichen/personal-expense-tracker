import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { vacuumInto } from "@/lib/database-copy";
import { inspectDatabaseFile } from "@/lib/database-inspection";
import { prisma } from "@/lib/prisma";
import { resolveStoragePaths, type StoragePaths } from "@/lib/storage-paths";

export type BackupResult = {
  path: string;
  createdAt: string;
  sizeBytes: number;
};

export async function createDatabaseBackup(options?: {
  now?: Date;
  paths?: StoragePaths;
}): Promise<BackupResult> {
  const now = options?.now ?? new Date();
  const paths = options?.paths ?? resolveStoragePaths();
  await mkdir(paths.backupDirectory, { recursive: true, mode: 0o700 });
  const destinationPath = path.join(
    paths.backupDirectory,
    `expense-tracker-${fileTimestamp(now)}-${randomUUID().slice(0, 8)}.db`,
  );

  await vacuumInto(prisma, destinationPath);
  try {
    const inspection = await inspectDatabaseFile(destinationPath);
    return {
      path: destinationPath,
      createdAt: (options?.now ?? new Date()).toISOString(),
      sizeBytes: inspection.sizeBytes,
    };
  } catch (error) {
    await rm(destinationPath, { force: true });
    throw error;
  }
}

function fileTimestamp(date: Date) {
  return date.toISOString().replaceAll(":", "-").replace(".000Z", "Z");
}
