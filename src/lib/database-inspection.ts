import { open, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const SQLITE_HEADER = "SQLite format 3\u0000";
const REQUIRED_COLUMNS = {
  categories: ["id", "name", "normalizedName", "color", "createdAt"],
  imports: [
    "id",
    "fileName",
    "fileFingerprint",
    "currency",
    "importedAt",
    "rowCount",
    "expenseCount",
    "excludedPaymentCount",
    "refundCount",
  ],
  transactions: [
    "id",
    "transactionDate",
    "sourceAmountMinor",
    "spendingAmountMinor",
    "currency",
    "merchant",
    "kind",
    "reviewStatus",
    "source",
    "createdAt",
    "updatedAt",
  ],
  budgets: [
    "id",
    "categoryId",
    "monthKey",
    "amountMinor",
    "createdAt",
    "updatedAt",
  ],
} as const;

export type DatabaseCounts = {
  categories: number;
  transactions: number;
  budgets: number;
  imports: number;
};

export type DatabaseInspection = {
  path: string;
  counts: DatabaseCounts;
  sizeBytes: number;
};

export class DatabaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseValidationError";
  }
}

export async function inspectDatabaseFile(
  databasePath: string,
): Promise<DatabaseInspection> {
  const resolvedPath = path.resolve(databasePath);
  const fileStats = await stat(resolvedPath).catch(() => null);
  if (!fileStats?.isFile()) {
    throw new DatabaseValidationError(
      "The selected database file was not found.",
    );
  }

  const file = await open(resolvedPath, "r");
  try {
    const header = Buffer.alloc(16);
    await file.read(header, 0, header.length, 0);
    if (header.toString("binary") !== SQLITE_HEADER) {
      throw new DatabaseValidationError(
        "The selected file is not a SQLite database.",
      );
    }
  } finally {
    await file.close();
  }

  const client = new PrismaClient({
    datasources: { db: { url: `file:${resolvedPath}` } },
  });

  try {
    const integrityRows = await client.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >("PRAGMA integrity_check");
    if (
      integrityRows.length !== 1 ||
      String(Object.values(integrityRows[0])[0]).toLowerCase() !== "ok"
    ) {
      throw new DatabaseValidationError("The SQLite integrity check failed.");
    }

    const foreignKeyErrors = await client.$queryRawUnsafe<unknown[]>(
      "PRAGMA foreign_key_check",
    );
    if (foreignKeyErrors.length > 0) {
      throw new DatabaseValidationError(
        "The database has broken relationships.",
      );
    }

    for (const [table, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
      const columns = await client.$queryRawUnsafe<Array<{ name: string }>>(
        `PRAGMA table_info("${table}")`,
      );
      const availableColumns = new Set(columns.map(({ name }) => name));
      if (requiredColumns.some((column) => !availableColumns.has(column))) {
        throw new DatabaseValidationError(
          "The database schema is incompatible with this application.",
        );
      }
    }

    const migrations = await client.$queryRawUnsafe<
      Array<{ migration_name: string }>
    >(
      "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
    );
    if (
      !migrations.some(
        ({ migration_name }) =>
          migration_name === "20261003095944_initial_schema",
      )
    ) {
      throw new DatabaseValidationError(
        "The database migration history is incompatible with this application.",
      );
    }

    const [categories, transactions, budgets, imports] = await Promise.all([
      client.category.count(),
      client.transaction.count(),
      client.budget.count(),
      client.importBatch.count(),
    ]);

    return {
      path: resolvedPath,
      sizeBytes: fileStats.size,
      counts: { categories, transactions, budgets, imports },
    };
  } catch (error) {
    if (error instanceof DatabaseValidationError) throw error;
    throw new DatabaseValidationError(
      "The database schema is incompatible with this application.",
    );
  } finally {
    await client.$disconnect();
  }
}

export function countsMatch(left: DatabaseCounts, right: DatabaseCounts) {
  return (
    left.categories === right.categories &&
    left.transactions === right.transactions &&
    left.budgets === right.budgets &&
    left.imports === right.imports
  );
}
