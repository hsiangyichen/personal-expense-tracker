import type { CategorizationRule } from "@/lib/categorization-engine";
import { categorizeMerchantWithRules } from "@/lib/categorization-engine";
import type { CsvReviewRow } from "@/lib/csv-parser";

export type ImportRowCategorization = ReturnType<
  typeof categorizeMerchantWithRules
> & {
  rowNumber: number;
};

export function categorizeImportRows(
  rows: CsvReviewRow[],
  rules: CategorizationRule[],
): ImportRowCategorization[] {
  return rows.flatMap((row) => {
    if (row.status !== "valid" || row.kind === "payment") {
      return [];
    }
    return [
      {
        rowNumber: row.rowNumber,
        ...categorizeMerchantWithRules(row.merchant, rules),
      },
    ];
  });
}
