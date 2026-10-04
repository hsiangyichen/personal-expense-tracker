"use server";

import { createDatabaseBackup } from "@/lib/backup-service";

export type BackupActionResult =
  | {
      success: true;
      path: string;
      createdAt: string;
      sizeBytes: number;
    }
  | { success: false; message: string };

export async function createBackupAction(): Promise<BackupActionResult> {
  try {
    const backup = await createDatabaseBackup();
    return { success: true, ...backup };
  } catch {
    return {
      success: false,
      message: "Could not create the backup. Check the data directory and try again.",
    };
  }
}
