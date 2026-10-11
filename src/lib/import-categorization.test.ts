import { describe, expect, it } from "vitest";
import { categorizeImportRows } from "@/lib/import-categorization";
import type { CategorizationRule } from "@/lib/categorization-engine";
import type { CsvReviewRow } from "@/lib/csv-parser";

const rules: CategorizationRule[] = [
  {
    id: "grocery-rule",
    matchType: "starts_with",
    pattern: "Illustrative Grocery",
    normalizedPattern: "illustrative grocery",
    categoryId: "groceries",
    priority: 0,
    enabled: true,
  },
];

function validRow(
  rowNumber: number,
  kind: "expense" | "payment" | "refund",
  merchant: string,
): Extract<CsvReviewRow, { status: "valid" }> {
  return {
    status: "valid",
    rowNumber,
    transactionDate: "2026-10-01",
    postDate: "2026-10-02",
    sourceType: kind,
    sourceDetails: merchant,
    sourceAmount: "10.00",
    sourceAmountMinor: 1_000,
    spendingAmountMinor: kind === "expense" ? 1_000 : 0,
    currency: "CAD",
    kind,
    merchant,
    reviewStatus: kind === "payment" ? "excluded" : "included",
    categoryId: null,
  };
}

describe("import categorization", () => {
  it("categorizes valid expenses and refunds but not payments", () => {
    const result = categorizeImportRows(
      [
        validRow(2, "expense", "Illustrative Grocery Downtown"),
        validRow(3, "refund", "Illustrative Grocery Refund"),
        validRow(4, "payment", "Illustrative Payment"),
      ],
      rules,
    );

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        status: "matched",
        categoryId: "groceries",
        ruleId: "grocery-rule",
      }),
      expect.objectContaining({
        rowNumber: 3,
        status: "matched",
        categoryId: "groceries",
        ruleId: "grocery-rule",
      }),
    ]);
  });

  it("keeps unmatched and conflicting rows explicit", () => {
    const conflictingRules: CategorizationRule[] = [
      {
        ...rules[0],
        id: "first",
        matchType: "contains",
        pattern: "redx",
        normalizedPattern: "redx",
        categoryId: "one",
      },
      {
        ...rules[0],
        id: "second",
        matchType: "contains",
        pattern: "blue",
        normalizedPattern: "blue",
        categoryId: "two",
      },
    ];
    const result = categorizeImportRows(
      [
        validRow(2, "expense", "Unmatched Merchant"),
        validRow(3, "expense", "Redx Blue Merchant"),
      ],
      conflictingRules,
    );

    expect(result[0]).toMatchObject({ rowNumber: 2, status: "unmatched" });
    expect(result[1]).toMatchObject({
      rowNumber: 3,
      status: "conflict",
      competingRuleIds: ["first", "second"],
    });
  });

  it("does not categorize invalid rows", () => {
    const invalid: CsvReviewRow = {
      status: "invalid",
      rowNumber: 2,
      transactionDate: "bad-date",
      postDate: "2026-10-02",
      sourceType: "Purchase",
      sourceDetails: "Illustrative Grocery",
      sourceAmount: "10.00",
      currency: "CAD",
      errors: ["Invalid date"],
    };

    expect(categorizeImportRows([invalid], rules)).toEqual([]);
  });
});
