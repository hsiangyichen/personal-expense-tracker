import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCreditCardCsv,
  type InvalidCsvRow,
  type ValidatedCsvRow,
} from "@/lib/csv-parser";

const fixturePath = path.resolve(
  "src/test/fixtures/synthetic-credit-card-statement.csv",
);
const headers = "transaction_date,post_date,type,details,amount,currency";

function csv(...rows: string[]) {
  return [headers, ...rows].join("\n");
}

function validRows(input: string) {
  return parseCreditCardCsv(input).rows.filter(
    (row): row is ValidatedCsvRow => row.status === "valid",
  );
}

function invalidRow(input: string) {
  const row = parseCreditCardCsv(input).rows[0];
  expect(row.status).toBe("invalid");
  return row as InvalidCsvRow;
}

describe("credit-card CSV parser", () => {
  it("parses the safe synthetic fixture without saving data", () => {
    const result = parseCreditCardCsv(readFileSync(fixturePath, "utf8"));

    expect(result.isValid).toBe(true);
    expect(result.headerErrors).toEqual([]);
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(4);
    expect(result.rows.map((row) => row.status)).toEqual([
      "valid",
      "valid",
      "valid",
      "valid",
    ]);
  });

  it("accepts reordered headers, a UTF-8 marker, quoted commas, and blank lines", () => {
    const result = parseCreditCardCsv(
      [
        "\uFEFFdetails,currency,amount,type,post_date,transaction_date",
        '"Synthetic Market, Example",CAD,10.25,Purchase,2026-02-02,2026-02-01',
        "",
      ].join("\n"),
    );

    expect(result.isValid).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      status: "valid",
      sourceDetails: "Synthetic Market, Example",
      merchant: "Synthetic Market, Example",
      sourceAmount: "10.25",
      sourceAmountMinor: 1_025,
    });
  });

  it("rejects missing and unsupported headers clearly", () => {
    const result = parseCreditCardCsv(
      "transaction_date,post_date,type,details,amount,account\n2026-01-01,2026-01-02,Purchase,Synthetic Example,10.00,Example",
    );

    expect(result.isValid).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.headerErrors).toEqual([
      "Missing required headers: currency.",
      "Unsupported headers: account.",
    ]);
  });

  it("rejects repeated headers explicitly", () => {
    const result = parseCreditCardCsv(
      "transaction_date,post_date,type,details,amount,currency,type\n2026-01-01,2026-01-02,Purchase,Synthetic Example,10.00,CAD,Purchase",
    );

    expect(result.isValid).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.headerErrors).toContain("CSV headers must not be repeated.");
  });

  it.each([
    ["2026-02-29", "Transaction date must use a valid YYYY-MM-DD date."],
    ["2026-13-01", "Transaction date must use a valid YYYY-MM-DD date."],
  ])("rejects invalid transaction date %s", (transactionDate, message) => {
    const row = invalidRow(
      csv(`${transactionDate},2026-03-01,Purchase,Synthetic Example,10.00,CAD`),
    );

    expect(row.errors).toContain(message);
  });

  it("accepts a real leap day and rejects an invalid post date", () => {
    expect(
      parseCreditCardCsv(
        csv("2028-02-29,2028-03-01,Purchase,Synthetic Example,10.00,CAD"),
      ).isValid,
    ).toBe(true);

    expect(
      invalidRow(
        csv("2028-02-29,2028-02-30,Purchase,Synthetic Example,10.00,CAD"),
      ).errors,
    ).toContain("Post date must use a valid YYYY-MM-DD date.");
  });

  it.each(["10.001", "1e2", "$10.00", "", "21474836.48"])(
    "rejects invalid amount %j",
    (amount) => {
      expect(
        invalidRow(
          csv(`2026-01-01,2026-01-02,Purchase,Synthetic Example,${amount},CAD`),
        ).errors.some((error) => error.startsWith("Amount")),
      ).toBe(true);
    },
  );

  it("accepts signed values with up to two decimal places and converts exactly", () => {
    const rows = validRows(
      csv(
        "2026-01-01,2026-01-02,Purchase,Synthetic Purchase,+10.50,CAD",
        "2026-01-03,2026-01-04,Payment,Synthetic Payment,-20.05,CAD",
      ),
    );

    expect(rows.map((row) => row.sourceAmountMinor)).toEqual([1_050, -2_005]);
  });

  it("rejects unsupported and mixed currencies at the file level", () => {
    const result = parseCreditCardCsv(
      csv(
        "2026-01-01,2026-01-02,Purchase,Synthetic CAD,10.00,CAD",
        "2026-01-03,2026-01-04,Purchase,Synthetic USD,10.00,USD",
      ),
    );

    expect(result.isValid).toBe(false);
    expect(result.fileErrors).toEqual(["CSV rows must all use CAD."]);
    expect(result.rows[1]).toMatchObject({
      status: "invalid",
      errors: ["Currency must be CAD."],
    });
  });

  it.each(["0", "-10.00"])(
    "rejects purchase amount %s instead of changing its sign",
    (amount) => {
      expect(
        invalidRow(
          csv(
            `2026-01-01,2026-01-02,Purchase,Synthetic Purchase,${amount},CAD`,
          ),
        ).errors,
      ).toContain("Purchase amount must be greater than zero.");
    },
  );

  it("normalizes a purchase to positive included spending", () => {
    expect(
      validRows(
        csv("2026-01-01,2026-01-02,Purchase,Synthetic Purchase,10.00,CAD"),
      )[0],
    ).toMatchObject({
      sourceType: "Purchase",
      sourceAmountMinor: 1_000,
      spendingAmountMinor: 1_000,
      kind: "expense",
      reviewStatus: "included",
      categoryId: null,
    });
  });

  it.each(["0", "+10.00", "10.00"])(
    "rejects payment amount %s instead of changing its sign",
    (amount) => {
      expect(
        invalidRow(
          csv(`2026-01-01,2026-01-02,Payment,Synthetic Payment,${amount},CAD`),
        ).errors,
      ).toContain("Payment amount must be less than zero.");
    },
  );

  it("preserves a payment with zero spending and no category", () => {
    expect(
      validRows(
        csv("2026-01-01,2026-01-02,Payment,Synthetic Payment,-10.00,CAD"),
      )[0],
    ).toMatchObject({
      sourceAmountMinor: -1_000,
      spendingAmountMinor: 0,
      kind: "payment",
      reviewStatus: "excluded",
      categoryId: null,
    });
  });

  it.each([
    ["Refund initiated", "5.00", 500],
    ["Refund initiated", "-5.00", -500],
    ["Refund settled", "5.00", 500],
    ["Refund settled", "-5.00", -500],
  ])(
    "marks %s amount %s for review without a spending effect",
    (type, amount, sourceAmountMinor) => {
      expect(
        validRows(
          csv(`2026-01-01,2026-01-02,${type},Synthetic Refund,${amount},CAD`),
        )[0],
      ).toMatchObject({
        sourceType: type,
        sourceAmountMinor,
        spendingAmountMinor: 0,
        kind: "refund",
        reviewStatus: "needs_review",
      });
    },
  );

  it("rejects zero refunds and unsupported transaction types", () => {
    expect(
      invalidRow(
        csv("2026-01-01,2026-01-02,Refund settled,Synthetic Refund,0,CAD"),
      ).errors,
    ).toContain("Refund amount must not be zero.");
    expect(
      invalidRow(
        csv("2026-01-01,2026-01-02,Adjustment,Synthetic Adjustment,10.00,CAD"),
      ).errors,
    ).toContain("Unsupported transaction type: Adjustment.");
  });

  it("preserves source fields and does not trim details", () => {
    const row = validRows(
      csv('2026-04-01,2026-04-03,Purchase,"  Synthetic Detail  ",10.00,CAD'),
    )[0];

    expect(row).toMatchObject({
      transactionDate: "2026-04-01",
      postDate: "2026-04-03",
      sourceType: "Purchase",
      sourceAmount: "10.00",
      sourceAmountMinor: 1_000,
      sourceDetails: "  Synthetic Detail  ",
      merchant: "  Synthetic Detail  ",
      currency: "CAD",
    });
  });

  it("reports malformed quoted fields at the file level", () => {
    const result = parseCreditCardCsv(
      `${headers}\n2026-01-01,2026-01-02,Purchase,"Synthetic,10.00,CAD`,
    );

    expect(result.isValid).toBe(false);
    expect(result.fileErrors).toContain(
      "Malformed CSV: Quoted field unterminated.",
    );
  });

  it.each([
    "2026-01-01,2026-01-02,Purchase,Synthetic Example,10.00",
    "2026-01-01,2026-01-02,Purchase,Synthetic Example,10.00,CAD,extra",
  ])("marks malformed row as invalid: %s", (rowText) => {
    expect(invalidRow(csv(rowText)).errors).toContain(
      "Row does not contain exactly six values.",
    );
  });
});
