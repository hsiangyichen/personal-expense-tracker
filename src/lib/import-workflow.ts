import { z } from "zod";
import type { CsvReviewRow } from "@/lib/csv-parser";
import type { DuplicateRowGroup } from "@/lib/import-review";
import type { ImportTransactionInput } from "@/lib/repositories/imports";

const decisionSchema = z.object({
  rowNumber: z.number().int().min(2),
  merchant: z.string().max(120).optional(),
  categoryId: z.string().optional(),
  duplicateDecision: z.enum(["include", "exclude"]).optional(),
  refundDecision: z.enum(["count", "exclude"]).optional(),
  invalidDecision: z.literal("exclude").optional(),
});

export type ImportRowDecision = z.infer<typeof decisionSchema>;

export type ImportResolution = {
  transactions: ImportTransactionInput[];
  countedRefundCount: number;
  excludedRefundCount: number;
  duplicateExcludedCount: number;
  invalidExcludedCount: number;
};

export class ImportResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportResolutionError";
  }
}

export function parseImportDecisions(value: string): ImportRowDecision[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ImportResolutionError("Import decisions are invalid.");
  }

  const result = z.array(decisionSchema).safeParse(parsed);
  if (!result.success) {
    throw new ImportResolutionError("Import decisions are invalid.");
  }

  return result.data;
}

export function resolveImportRows(
  rows: CsvReviewRow[],
  decisions: ImportRowDecision[],
  duplicateGroups: DuplicateRowGroup[],
): ImportResolution {
  const rowNumbers = new Set(rows.map((row) => row.rowNumber));
  const decisionsByRow = new Map<number, ImportRowDecision>();

  for (const decision of decisions) {
    if (
      !rowNumbers.has(decision.rowNumber) ||
      decisionsByRow.has(decision.rowNumber)
    ) {
      throw new ImportResolutionError(
        "Import decisions do not match the file.",
      );
    }
    decisionsByRow.set(decision.rowNumber, decision);
  }

  const duplicateRows = new Set(
    duplicateGroups.flatMap((group) => group.rowNumbers),
  );
  const resolution: ImportResolution = {
    transactions: [],
    countedRefundCount: 0,
    excludedRefundCount: 0,
    duplicateExcludedCount: 0,
    invalidExcludedCount: 0,
  };

  for (const row of rows) {
    const decision = decisionsByRow.get(row.rowNumber);
    if (!decision) {
      throw new ImportResolutionError(`Row ${row.rowNumber} needs review.`);
    }

    if (row.status === "invalid") {
      if (decision.invalidDecision !== "exclude") {
        throw new ImportResolutionError(
          `Row ${row.rowNumber} must be explicitly excluded.`,
        );
      }
      resolution.invalidExcludedCount += 1;
      continue;
    }

    if (duplicateRows.has(row.rowNumber)) {
      if (!decision.duplicateDecision) {
        throw new ImportResolutionError(
          `Row ${row.rowNumber} needs a duplicate decision.`,
        );
      }
      if (decision.duplicateDecision === "exclude") {
        resolution.duplicateExcludedCount += 1;
        continue;
      }
    }

    const merchant = decision.merchant?.trim();
    if (!merchant || merchant.length > 120) {
      throw new ImportResolutionError(
        `Row ${row.rowNumber} needs a merchant of 120 characters or fewer.`,
      );
    }

    if (row.kind === "expense") {
      if (!decision.categoryId) {
        throw new ImportResolutionError(
          `Row ${row.rowNumber} needs a category.`,
        );
      }
      resolution.transactions.push({
        ...sourceTransaction(row, merchant),
        spendingAmountMinor: row.sourceAmountMinor,
        reviewStatus: "included",
        categoryId: decision.categoryId,
      });
      continue;
    }

    if (row.kind === "payment") {
      resolution.transactions.push({
        ...sourceTransaction(row, merchant),
        spendingAmountMinor: 0,
        reviewStatus: "excluded",
        categoryId: null,
      });
      continue;
    }

    if (!decision.refundDecision) {
      throw new ImportResolutionError(
        `Row ${row.rowNumber} needs a refund decision.`,
      );
    }

    if (decision.refundDecision === "count") {
      if (!decision.categoryId) {
        throw new ImportResolutionError(
          `Row ${row.rowNumber} needs a category.`,
        );
      }
      resolution.transactions.push({
        ...sourceTransaction(row, merchant),
        spendingAmountMinor: -Math.abs(row.sourceAmountMinor),
        reviewStatus: "included",
        categoryId: decision.categoryId,
      });
      resolution.countedRefundCount += 1;
    } else {
      resolution.transactions.push({
        ...sourceTransaction(row, merchant),
        spendingAmountMinor: 0,
        reviewStatus: "excluded",
        categoryId: null,
      });
      resolution.excludedRefundCount += 1;
    }
  }

  return resolution;
}

function sourceTransaction(
  row: Extract<CsvReviewRow, { status: "valid" }>,
  merchant: string,
) {
  return {
    transactionDate: row.transactionDate,
    postDate: row.postDate,
    sourceAmountMinor: row.sourceAmountMinor,
    merchant,
    sourceDetails: row.sourceDetails,
    sourceType: row.sourceType,
    kind: row.kind,
  };
}
