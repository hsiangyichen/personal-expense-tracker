import { randomUUID } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdir,
  open,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { assertApplicationStopped } from "@/lib/application-lock";
import { createConsistentDatabaseCopy } from "@/lib/database-copy";
import {
  countsMatch,
  DatabaseValidationError,
  inspectDatabaseFile,
  type DatabaseInspection,
} from "@/lib/database-inspection";
import { resolveStoragePaths, type StoragePaths } from "@/lib/storage-paths";

export type RestoreResult = {
  restoredFrom: string;
  safetyCopyPath: string;
  counts: DatabaseInspection["counts"];
};

export type RestoreOptions = {
  paths?: StoragePaths;
  now?: Date;
  beforeReplace?: () => void | Promise<void>;
  verifyRestored?: (
    inspection: DatabaseInspection,
    expected: DatabaseInspection,
  ) => boolean | Promise<boolean>;
};

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestoreError";
  }
}

export async function restoreDatabaseBackup(
  backupPath: string,
  options: RestoreOptions = {},
): Promise<RestoreResult> {
  const paths = options.paths ?? resolveStoragePaths();
  const selectedPath = path.resolve(backupPath);
  await assertApplicationStopped(paths.runtimeMarkerDirectory);

  const [selectedRealPath, databaseRealPath] = await Promise.all([
    realpath(selectedPath).catch(() => selectedPath),
    realpath(paths.databasePath).catch(() => paths.databasePath),
  ]);
  if (selectedRealPath === databaseRealPath) {
    throw new RestoreError("Choose a backup instead of the active database.");
  }

  const expected = await inspectDatabaseFile(selectedPath);
  await inspectDatabaseFile(paths.databasePath);
  await mkdir(paths.backupDirectory, { recursive: true, mode: 0o700 });
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 });

  const identifier = randomUUID().slice(0, 8);
  const timestamp = fileTimestamp(options.now ?? new Date());
  const safetyCopyPath = path.join(
    paths.backupDirectory,
    `pre-restore-${timestamp}-${identifier}.db`,
  );
  const stagedPath = path.join(
    paths.dataDirectory,
    `.restore-${identifier}.db`,
  );
  const rollbackPath = path.join(
    paths.dataDirectory,
    `.rollback-${identifier}.db`,
  );
  let replaced = false;

  try {
    await createConsistentDatabaseCopy(paths.databasePath, safetyCopyPath);
    await copyAndSync(selectedPath, stagedPath);
    await options.beforeReplace?.();
    await removeSqliteSidecars(paths.databasePath);
    await rename(stagedPath, paths.databasePath);
    replaced = true;
    await syncDirectory(paths.dataDirectory);

    const restored = await inspectDatabaseFile(paths.databasePath);
    const verified = options.verifyRestored
      ? await options.verifyRestored(restored, expected)
      : countsMatch(restored.counts, expected.counts);
    if (!verified || !countsMatch(restored.counts, expected.counts)) {
      throw new RestoreError(
        "Restored record counts did not match the backup.",
      );
    }

    return {
      restoredFrom: selectedPath,
      safetyCopyPath,
      counts: restored.counts,
    };
  } catch (error) {
    if (replaced) {
      try {
        await copyAndSync(safetyCopyPath, rollbackPath);
        await removeSqliteSidecars(paths.databasePath);
        await rename(rollbackPath, paths.databasePath);
        await syncDirectory(paths.dataDirectory);
        const rolledBack = await inspectDatabaseFile(paths.databasePath);
        const safety = await inspectDatabaseFile(safetyCopyPath);
        if (!countsMatch(rolledBack.counts, safety.counts)) {
          throw new Error("Rollback counts did not match the safety copy.");
        }
      } catch {
        throw new RestoreError(
          `Restore and automatic rollback failed. Recover manually from ${safetyCopyPath}.`,
        );
      }

      throw new RestoreError(
        `Restore verification failed. The original database was restored from ${safetyCopyPath}.`,
      );
    }

    if (
      error instanceof DatabaseValidationError ||
      error instanceof RestoreError
    ) {
      throw error;
    }
    throw new RestoreError("Restore stopped before database replacement.");
  } finally {
    await Promise.all([
      rm(stagedPath, { force: true }),
      rm(rollbackPath, { force: true }),
    ]);
  }
}

async function copyAndSync(sourcePath: string, destinationPath: string) {
  await rm(destinationPath, { force: true });
  await copyFile(sourcePath, destinationPath);
  await chmod(destinationPath, 0o600);
  const file = await open(destinationPath, "r+");
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}

async function removeSqliteSidecars(databasePath: string) {
  await Promise.all(
    ["-journal", "-shm", "-wal"].map((suffix) =>
      rm(`${databasePath}${suffix}`, { force: true }),
    ),
  );
}

async function syncDirectory(directoryPath: string) {
  const directory = await open(directoryPath, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

function fileTimestamp(date: Date) {
  return date.toISOString().replaceAll(":", "-").replace(".000Z", "Z");
}
