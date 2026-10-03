import { describe, expect, it } from "vitest";
import {
  expenseFormSchema,
  isValidDateOnly,
  isValidMonthKey,
} from "@/lib/expense-validation";

const validExpense = {
  transactionDate: "2026-10-03",
  amount: "12.34",
  currency: "CAD",
  merchant: "Example market",
  categoryId: "category-1",
  note: "Weekly groceries",
};

describe("manual expense validation", () => {
  it("normalizes a valid expense", () => {
    expect(expenseFormSchema.parse(validExpense)).toEqual({
      transactionDate: "2026-10-03",
      amountMinor: 1234,
      currency: "CAD",
      merchant: "Example market",
      categoryId: "category-1",
      note: "Weekly groceries",
    });
  });

  it("turns a blank note into null", () => {
    expect(
      expenseFormSchema.parse({ ...validExpense, note: "   " }).note,
    ).toBeNull();
  });

  it.each([
    ["currency", { currency: "USD" }],
    ["merchant", { merchant: " " }],
    ["category", { categoryId: "" }],
    ["amount", { amount: "0" }],
    ["date", { transactionDate: "2026-02-30" }],
  ])("rejects an invalid %s", (_field, change) => {
    expect(
      expenseFormSchema.safeParse({ ...validExpense, ...change }).success,
    ).toBe(false);
  });
});

describe("date-only validation", () => {
  it.each(["2024-02-29", "2026-01-01", "2026-12-31"])("accepts %s", (value) => {
    expect(isValidDateOnly(value)).toBe(true);
  });

  it.each(["2023-02-29", "2026-04-31", "2026-13-01", "10/03/2026"])(
    "rejects %s",
    (value) => {
      expect(isValidDateOnly(value)).toBe(false);
    },
  );

  it.each(["2026-01", "2026-12"])("accepts month key %s", (value) => {
    expect(isValidMonthKey(value)).toBe(true);
  });

  it.each(["2026-00", "2026-13", "2026-1"])("rejects month key %s", (value) => {
    expect(isValidMonthKey(value)).toBe(false);
  });
});
