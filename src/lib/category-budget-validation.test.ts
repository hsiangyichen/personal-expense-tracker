import { describe, expect, it } from "vitest";
import {
  normalizeCategoryName,
  parseBudgetFormData,
  parseCategoryFormData,
} from "@/lib/category-budget-validation";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("category validation", () => {
  it("collapses spacing and normalizes capitalization", () => {
    const result = parseCategoryFormData(
      formData({ name: "  Pet   Care  ", color: "#AABBCC" }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        name: "Pet Care",
        normalizedName: "pet care",
        color: "#aabbcc",
      },
    });
    expect(normalizeCategoryName(" PET\t care ")).toBe("pet care");
  });

  it("rejects empty, overlong, and invalid-color categories", () => {
    expect(
      parseCategoryFormData(formData({ name: " ", color: "#123456" })).success,
    ).toBe(false);
    expect(
      parseCategoryFormData(
        formData({ name: "x".repeat(51), color: "#123456" }),
      ).success,
    ).toBe(false);
    expect(
      parseCategoryFormData(formData({ name: "Pets", color: "red" })).success,
    ).toBe(false);
  });
});

describe("budget validation", () => {
  it("converts a positive CAD amount to integer cents", () => {
    const result = parseBudgetFormData(
      formData({
        categoryId: "category-1",
        monthKey: "2026-11",
        amount: "123.45",
        currency: "CAD",
      }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        categoryId: "category-1",
        monthKey: "2026-11",
        amountMinor: 12_345,
      },
    });
  });

  it.each([
    [
      "missing category",
      { categoryId: "", monthKey: "2026-11", amount: "10", currency: "CAD" },
    ],
    [
      "invalid month",
      {
        categoryId: "category-1",
        monthKey: "2026-13",
        amount: "10",
        currency: "CAD",
      },
    ],
    [
      "zero amount",
      {
        categoryId: "category-1",
        monthKey: "2026-11",
        amount: "0",
        currency: "CAD",
      },
    ],
    [
      "fractional cent",
      {
        categoryId: "category-1",
        monthKey: "2026-11",
        amount: "1.001",
        currency: "CAD",
      },
    ],
    [
      "wrong currency",
      {
        categoryId: "category-1",
        monthKey: "2026-11",
        amount: "10",
        currency: "USD",
      },
    ],
  ])("rejects %s", (_label, values) => {
    expect(parseBudgetFormData(formData(values)).success).toBe(false);
  });
});
