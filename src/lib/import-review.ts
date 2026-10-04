import { createHash } from "node:crypto";
import type { CsvReviewRow, ValidatedCsvRow } from "@/lib/csv-parser";

export type DuplicateRowGroup = {
  key: string;
  rowNumbers: number[];
};

export function calculateFileFingerprint(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function findDuplicateRowGroups(
  rows: CsvReviewRow[],
): DuplicateRowGroup[] {
  const rowNumbersByKey = new Map<string, number[]>();

  for (const row of rows) {
    const key = sourceRowKey(row);
    const rowNumbers = rowNumbersByKey.get(key) ?? [];
    rowNumbers.push(row.rowNumber);
    rowNumbersByKey.set(key, rowNumbers);
  }

  return [...rowNumbersByKey.entries()]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([key, rowNumbers]) => ({ key, rowNumbers }))
    .sort((left, right) => left.rowNumbers[0] - right.rowNumbers[0]);
}

function sourceRowKey(row: CsvReviewRow): string {
  return JSON.stringify([
    row.transactionDate,
    row.postDate,
    row.sourceType,
    row.sourceDetails,
    row.sourceAmount,
    row.currency,
  ]);
}

export type SimilarRefundPair = {
  rowNumbers: [number, number];
};

export function findSimilarRefundPairs(
  rows: CsvReviewRow[],
  nearbyDays = 7,
): SimilarRefundPair[] {
  const refunds = rows.filter(
    (row): row is ValidatedCsvRow =>
      row.status === "valid" && row.kind === "refund",
  );
  const pairs: SimilarRefundPair[] = [];

  for (let leftIndex = 0; leftIndex < refunds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < refunds.length;
      rightIndex += 1
    ) {
      const left = refunds[leftIndex];
      const right = refunds[rightIndex];
      if (
        left.sourceDetails === right.sourceDetails &&
        Math.abs(left.sourceAmountMinor) ===
          Math.abs(right.sourceAmountMinor) &&
        left.currency === right.currency &&
        dateDistanceInDays(left.transactionDate, right.transactionDate) <=
          nearbyDays
      ) {
        pairs.push({ rowNumbers: [left.rowNumber, right.rowNumber] });
      }
    }
  }

  return pairs;
}

function dateDistanceInDays(left: string, right: string) {
  const millisecondsPerDay = 24 * 60 * 60 * 1_000;
  return (
    Math.abs(
      Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`),
    ) / millisecondsPerDay
  );
}
