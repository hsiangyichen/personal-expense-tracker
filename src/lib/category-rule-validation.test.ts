import { describe, expect, it } from "vitest";
import {
  InvalidCategoryRuleError,
  prepareCategoryRuleInput,
} from "@/lib/category-rule-validation";

describe("category rule validation", () => {
  it("normalizes patterns and applies safe defaults", () => {
    expect(
      prepareCategoryRuleInput({
        matchType: "exact",
        pattern: "  Sample #123  ",
        categoryId: " category-id ",
      }),
    ).toEqual({
      matchType: "exact",
      pattern: "Sample #123",
      normalizedPattern: "sample 123",
      categoryId: "category-id",
      priority: 0,
      enabled: true,
    });
  });

  it.each([
    ["empty pattern", "", 0],
    ["no merchant tokens", "---", 0],
    ["oversized priority", "sample", 1001],
    ["negative priority", "sample", -1],
  ])("rejects %s", (_label, pattern, priority) => {
    expect(() =>
      prepareCategoryRuleInput({
        matchType: "exact",
        pattern,
        categoryId: "category-id",
        priority,
      }),
    ).toThrow(InvalidCategoryRuleError);
  });
});
