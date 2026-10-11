import { describe, expect, it } from "vitest";
import {
  categorizeMerchantWithRules,
  type CategorizationRule,
} from "@/lib/categorization-engine";
import type { CategoryRuleMatchType } from "@/lib/category-rule-validation";
import { normalizeMerchant } from "@/lib/merchant-normalization";

function rule({
  categoryId,
  enabled = true,
  id,
  matchType,
  pattern,
  priority = 0,
}: {
  id: string;
  matchType: CategoryRuleMatchType;
  pattern: string;
  categoryId: string;
  priority?: number;
  enabled?: boolean;
}): CategorizationRule {
  return {
    id,
    matchType,
    pattern,
    normalizedPattern: normalizeMerchant(pattern),
    categoryId,
    priority,
    enabled,
  };
}

describe("categorization rule engine", () => {
  it("prefers exact rules over broader higher-priority rules", () => {
    const result = categorizeMerchantWithRules("Sample Market", [
      rule({
        id: "contains",
        matchType: "contains",
        pattern: "market",
        categoryId: "other",
        priority: 1000,
      }),
      rule({
        id: "exact",
        matchType: "exact",
        pattern: "sample market",
        categoryId: "groceries",
      }),
    ]);

    expect(result).toMatchObject({
      status: "matched",
      categoryId: "groceries",
      ruleId: "exact",
      confidenceBasisPoints: 10_000,
    });
  });

  it("uses token boundaries for starts-with and contains rules", () => {
    const rules = [
      rule({
        id: "starts",
        matchType: "starts_with",
        pattern: "star",
        categoryId: "first",
      }),
      rule({
        id: "contains",
        matchType: "contains",
        pattern: "market",
        categoryId: "second",
      }),
    ];

    expect(categorizeMerchantWithRules("Starbucks", rules).status).toBe(
      "unmatched",
    );
    expect(
      categorizeMerchantWithRules("Neighbourhood Marketplace", rules).status,
    ).toBe("unmatched");
    expect(
      categorizeMerchantWithRules("Star Coffee at Market Street", rules),
    ).toMatchObject({ status: "matched", ruleId: "starts" });
  });

  it("uses priority and then pattern specificity within one match type", () => {
    const higherPriority = categorizeMerchantWithRules("Sample Coffee Shop", [
      rule({
        id: "specific",
        matchType: "starts_with",
        pattern: "sample coffee",
        categoryId: "dining",
        priority: 1,
      }),
      rule({
        id: "priority",
        matchType: "starts_with",
        pattern: "sample",
        categoryId: "other",
        priority: 2,
      }),
    ]);
    expect(higherPriority).toMatchObject({
      status: "matched",
      ruleId: "priority",
    });

    const moreSpecific = categorizeMerchantWithRules("Sample Coffee Shop", [
      rule({
        id: "general",
        matchType: "starts_with",
        pattern: "sample",
        categoryId: "other",
      }),
      rule({
        id: "specific",
        matchType: "starts_with",
        pattern: "sample coffee",
        categoryId: "dining",
      }),
    ]);
    expect(moreSpecific).toMatchObject({
      status: "matched",
      ruleId: "specific",
    });
  });

  it("returns a conflict when equally preferred rules disagree", () => {
    const result = categorizeMerchantWithRules("Blue Cyan Market", [
      rule({
        id: "blue",
        matchType: "contains",
        pattern: "blue",
        categoryId: "one",
      }),
      rule({
        id: "cyan",
        matchType: "contains",
        pattern: "cyan",
        categoryId: "two",
      }),
    ]);

    expect(result).toEqual({
      status: "conflict",
      normalizedMerchant: "blue cyan market",
      competingRuleIds: ["blue", "cyan"],
    });
  });

  it("chooses deterministically when equally preferred rules agree", () => {
    const result = categorizeMerchantWithRules("Blue Cyan Market", [
      rule({
        id: "cyan",
        matchType: "contains",
        pattern: "cyan",
        categoryId: "same",
      }),
      rule({
        id: "blue",
        matchType: "contains",
        pattern: "blue",
        categoryId: "same",
      }),
    ]);

    expect(result).toMatchObject({
      status: "matched",
      categoryId: "same",
      ruleId: "blue",
    });
  });

  it("ignores disabled rules and blank merchants", () => {
    const rules = [
      rule({
        id: "disabled",
        matchType: "exact",
        pattern: "sample",
        categoryId: "category",
        enabled: false,
      }),
    ];

    expect(categorizeMerchantWithRules("Sample", rules).status).toBe(
      "unmatched",
    );
    expect(categorizeMerchantWithRules(" -- ", rules)).toEqual({
      status: "unmatched",
      normalizedMerchant: "",
    });
  });
});
