import "dotenv/config";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { inspectDatabaseFile } from "../src/lib/database-inspection";

const backupDirectory = process.env.BACKUP_DIRECTORY;

test.afterAll(async () => {
  if (backupDirectory) {
    await rm(backupDirectory, { recursive: true, force: true });
  }
});

test("creates and validates a local database backup", async ({ page }) => {
  if (!backupDirectory) throw new Error("BACKUP_DIRECTORY is required.");

  await page.goto("/data");
  await expect(page.getByText("No imports yet")).toBeVisible();
  await page.getByRole("button", { name: "Create backup" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText("Backup created.");
  await expect
    .poll(
      async () =>
        (await readdir(backupDirectory)).filter((name) => name.endsWith(".db"))
          .length,
    )
    .toBe(1);
  const backupFiles = (await readdir(backupDirectory)).filter((name) =>
    name.endsWith(".db"),
  );
  const backupPath = path.join(backupDirectory, backupFiles[0]);
  const inspection = await inspectDatabaseFile(backupPath);

  await expect(status).toContainText(backupPath);
  expect(inspection.counts.categories).toBeGreaterThanOrEqual(8);
  expect(inspection.sizeBytes).toBeGreaterThan(0);
});
