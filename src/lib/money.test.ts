import { describe, expect, it } from "vitest";
import { formatCadFromCents, parsePositiveCadAmountToCents } from "@/lib/money";

describe("CAD money helpers", () => {
  it.each([
    ["12", 1200],
    ["12.3", 1230],
    ["12.34", 1234],
    [" 1.05 ", 105],
    ["21474836.47", 2_147_483_647],
  ])("converts %s to integer cents", (displayAmount, expected) => {
    expect(parsePositiveCadAmountToCents(displayAmount)).toBe(expected);
  });

  it.each(["1.234", "1.", ".50", "1,000.00", "CAD 1.00", "abc"])(
    "rejects the invalid decimal %s",
    (displayAmount) => {
      expect(() => parsePositiveCadAmountToCents(displayAmount)).toThrow(
        "Enter a valid amount with up to two decimal places.",
      );
    },
  );

  it.each(["0", "0.00", "-1", "-0.01"])(
    "rejects the non-positive manual amount %s",
    (displayAmount) => {
      expect(() => parsePositiveCadAmountToCents(displayAmount)).toThrow(
        "Amount must be greater than zero.",
      );
    },
  );

  it("rejects amounts larger than the database integer range", () => {
    expect(() => parsePositiveCadAmountToCents("21474836.48")).toThrow(
      "Amount is too large.",
    );
  });

  it.each([
    [0, "$0.00 CAD"],
    [5, "$0.05 CAD"],
    [1234, "$12.34 CAD"],
    [123456789, "$1,234,567.89 CAD"],
    [-505, "-$5.05 CAD"],
  ])("formats %i cents as %s", (amountMinor, expected) => {
    expect(formatCadFromCents(amountMinor)).toBe(expected);
  });

  it("rejects fractional minor units", () => {
    expect(() => formatCadFromCents(1.5)).toThrow(
      "Amount must use whole cents.",
    );
  });
});
