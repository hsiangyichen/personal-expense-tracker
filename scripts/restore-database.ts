import "dotenv/config";
import path from "node:path";
import { restoreDatabaseBackup } from "../src/lib/restore-service";

async function main() {
  const argumentsList = process.argv.slice(2);
  const backupPath = argumentsList.find((argument) => argument !== "--confirm");
  const confirmed = argumentsList.includes("--confirm");

  if (!backupPath || !confirmed) {
    throw new Error(
      "Usage: npm run db:restore -- /absolute/path/to/backup.db --confirm",
    );
  }

  const result = await restoreDatabaseBackup(path.resolve(backupPath));
  console.log(`Database restored from: ${result.restoredFrom}`);
  console.log(`Safety copy created at: ${result.safetyCopyPath}`);
  console.log(
    `Verified counts: ${result.counts.transactions} transactions, ${result.counts.categories} categories, ${result.counts.budgets} budgets, ${result.counts.imports} imports.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Restore failed.");
  process.exitCode = 1;
});
