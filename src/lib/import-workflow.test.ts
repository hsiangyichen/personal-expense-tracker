import { describe, expect, it } from "vitest";
import { parseCreditCardCsv } from "@/lib/csv-parser";
import { findDuplicateRowGroups } from "@/lib/import-review";
import {
  ImportResolutionError,
  parseImportDecisions,
  resolveImportRows,
  type ImportRowDecision,
} from "@/lib/import-workflow";

const headers = "transaction_date,post_date,type,details,amount,currency";

function rows(...values: string[]) {
  return parseCreditCardCsv([headers, ...values].join("\n")).rows;
}

function decision(
  rowNumber: number,
  overrides: Partial<ImportRowDecision> = {},
): ImportRowDecision {
  return {
    rowNumber,
    merchant: `Edited merchant ${rowNumber}`,
    categoryId: "category-1",
    ...overrides,
  };
}

describe("import row resolution", () => {
  it("preserves source details while accepting a merchant correction", () => {
    const reviewRows = rows(
      "2026-01-01,2026-01-02,Purchase,Original details,10.00,CAD",
    );

    const result = resolveImportRows(reviewRows, [decision(2)], []);

    expect(result.transactions[0]).toMatchObject({
      merchant: "Edited merchant 2",
      sourceDetails: "Original details",
      sourceAmountMinor: 1_000,
      spendingAmountMinor: 1_000,
      categoryId: "category-1",
    });
  });

  it("requires an overlong merchant to be corrected", () => {
    const reviewRows = rows(
      `2026-01-01,2026-01-02,Purchase,${"x".repeat(121)},10.00,CAD`,
    );

    expect(() =>
      resolveImportRows(
        reviewRows,
        [decision(2, { merchant: "x".repeat(121) })],
        [],
      ),
    ).toThrow("Row 2 needs a merchant of 120 characters or fewer.");
  });

  it("requires categories for purchases and counted refunds", () => {
    const purchaseRows = rows(
      "2026-01-01,2026-01-02,Purchase,Synthetic purchase,10.00,CAD",
    );
    const refundRows = rows(
      "2026-01-03,2026-01-04,Refund settled,Synthetic refund,-5.00,CAD",
    );

    expect(() =>
      resolveImportRows(purchaseRows, [decision(2, { categoryId: "" })], []),
    ).toThrow("Row 2 needs a category.");
    expect(() =>
      resolveImportRows(refundRows, [decision(2, { categoryId: "" })], []),
    ).toThrow("Row 2 needs a category.");
  });

  it("counts kept refunds and skips deleted refunds", () => {
    const reviewRows = rows(
      "2026-01-01,2026-01-02,Refund initiated,Synthetic refund,5.00,CAD",
      "2026-01-03,2026-01-04,Refund settled,Synthetic refund,-5.00,CAD",
    );

    const result = resolveImportRows(
      reviewRows,
      [decision(2), decision(3, { excluded: true })],
      [],
    );

    expect(result.transactions).toEqual([
      expect.objectContaining({
        sourceAmountMinor: 500,
        spendingAmountMinor: -500,
        reviewStatus: "included",
        categoryId: "category-1",
      }),
    ]);
    expect(result.countedRefundCount).toBe(1);
    expect(result.excludedRefundCount).toBe(1);
  });

  it("includes duplicate warnings by default and skips deleted rows", () => {
    const reviewRows = rows(
      "2026-01-01,2026-01-02,Purchase,Synthetic duplicate,10.00,CAD",
      "2026-01-01,2026-01-02,Purchase,Synthetic duplicate,10.00,CAD",
    );
    const duplicateGroups = findDuplicateRowGroups(reviewRows);

    const included = resolveImportRows(
      reviewRows,
      [decision(2), decision(3)],
      duplicateGroups,
    );
    expect(included.transactions).toHaveLength(2);

    const deleted = resolveImportRows(
      reviewRows,
      [decision(2), decision(3, { excluded: true })],
      duplicateGroups,
    );

    expect(deleted.transactions).toHaveLength(1);
    expect(deleted.duplicateExcludedCount).toBe(1);
  });

  it("requires every invalid row to be deleted", () => {
    const reviewRows = rows(
      "2026-01-01,2026-01-02,Purchase,Synthetic invalid,-10.00,CAD",
    );

    expect(() => resolveImportRows(reviewRows, [decision(2)], [])).toThrow(
      "Row 2 is invalid and must be deleted.",
    );

    const result = resolveImportRows(
      reviewRows,
      [{ rowNumber: 2, excluded: true }],
      [],
    );
    expect(result.transactions).toEqual([]);
    expect(result.invalidExcludedCount).toBe(1);
  });

  it("collects unique remembered exact rules and rejects conflicts", () => {
    const reviewRows = rows(
      "2026-01-01,2026-01-02,Purchase,First purchase,10.00,CAD",
      "2026-01-03,2026-01-04,Purchase,Second purchase,20.00,CAD",
    );
    const remembered = resolveImportRows(
      reviewRows,
      [
        decision(2, {
          merchant: "Sample #123",
          rememberCategoryRule: true,
        }),
        decision(3, {
          merchant: " sample 123 ",
          rememberCategoryRule: true,
        }),
      ],
      [],
    );

    expect(remembered.categoryRules).toEqual([
      expect.objectContaining({
        matchType: "exact",
        pattern: "Sample #123",
        normalizedPattern: "sample 123",
        categoryId: "category-1",
      }),
    ]);

    expect(() =>
      resolveImportRows(
        reviewRows,
        [
          decision(2, {
            merchant: "Sample Merchant",
            categoryId: "category-1",
            rememberCategoryRule: true,
          }),
          decision(3, {
            merchant: "sample merchant",
            categoryId: "category-2",
            rememberCategoryRule: true,
          }),
        ],
        [],
      ),
    ).toThrow(
      "The same merchant cannot be remembered with different categories.",
    );
  });

  it("rejects malformed, duplicate, and unknown decision records", () => {
    expect(() => parseImportDecisions("not json")).toThrow(
      ImportResolutionError,
    );
    expect(() => parseImportDecisions('[{"rowNumber":1}]')).toThrow(
      ImportResolutionError,
    );

    const reviewRows = rows(
      "2026-01-01,2026-01-02,Purchase,Synthetic purchase,10.00,CAD",
    );
    expect(() =>
      resolveImportRows(reviewRows, [decision(2), decision(2)], []),
    ).toThrow("Import decisions do not match the file.");
    expect(() => resolveImportRows(reviewRows, [decision(99)], [])).toThrow(
      "Import decisions do not match the file.",
    );
  });
});
