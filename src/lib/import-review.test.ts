import { describe, expect, it } from "vitest";
import { parseCreditCardCsv } from "@/lib/csv-parser";
import {
  calculateFileFingerprint,
  findDuplicateRowGroups,
  findSimilarRefundPairs,
} from "@/lib/import-review";

const headers = "transaction_date,post_date,type,details,amount,currency";
const sourceRow = "2026-01-01,2026-01-02,Purchase,Synthetic Example,10.00,CAD";

describe("import review helpers", () => {
  it("fingerprints the original bytes deterministically", () => {
    const first = new TextEncoder().encode(`${headers}\n${sourceRow}\n`);
    const second = new TextEncoder().encode(`${headers}\n${sourceRow}\n`);

    expect(calculateFileFingerprint(first)).toBe(
      calculateFileFingerprint(second),
    );
    expect(calculateFileFingerprint(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the fingerprint when any original byte changes", () => {
    const unix = new TextEncoder().encode(`${headers}\n${sourceRow}\n`);
    const windows = new TextEncoder().encode(`${headers}\r\n${sourceRow}\r\n`);

    expect(calculateFileFingerprint(unix)).not.toBe(
      calculateFileFingerprint(windows),
    );
  });

  it("warns for exact six-field matches without removing either row", () => {
    const result = parseCreditCardCsv(
      `${headers}\n${sourceRow}\n${sourceRow}\n`,
    );
    const groups = findDuplicateRowGroups(result.rows);

    expect(result.rows).toHaveLength(2);
    expect(groups).toEqual([
      {
        key: JSON.stringify([
          "2026-01-01",
          "2026-01-02",
          "Purchase",
          "Synthetic Example",
          "10.00",
          "CAD",
        ]),
        rowNumbers: [2, 3],
      },
    ]);
  });

  it("does not warn when any source field differs", () => {
    const rows = [
      sourceRow,
      sourceRow.replace("2026-01-01", "2026-01-03"),
      sourceRow.replace("2026-01-02", "2026-01-04"),
      sourceRow.replace("Purchase", "Refund settled"),
      sourceRow.replace("Synthetic Example", "Synthetic Other"),
      sourceRow.replace("10.00", "10.01"),
      sourceRow.replace("CAD", "USD"),
    ];
    const result = parseCreditCardCsv(`${headers}\n${rows.join("\n")}\n`);

    expect(findDuplicateRowGroups(result.rows)).toEqual([]);
    expect(result.rows).toHaveLength(rows.length);
  });
});

describe("similar refund warnings", () => {
  it("finds matching refund rows with either source sign on nearby dates", () => {
    const csv = [
      "transaction_date,post_date,type,details,amount,currency",
      "2026-01-01,2026-01-02,Refund initiated,Synthetic Refund,5.00,CAD",
      "2026-01-05,2026-01-06,Refund settled,Synthetic Refund,-5.00,CAD",
      "2026-02-01,2026-02-02,Refund settled,Synthetic Refund,-5.00,CAD",
      "2026-01-05,2026-01-06,Refund settled,Synthetic Other,-5.00,CAD",
    ].join("\n");

    expect(findSimilarRefundPairs(parseCreditCardCsv(csv).rows)).toEqual([
      { rowNumbers: [2, 3] },
    ]);
  });
});
