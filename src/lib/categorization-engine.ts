import type { CategoryRuleMatchType } from "@/lib/category-rule-validation";
import { normalizeMerchant } from "@/lib/merchant-normalization";

export type CategorizationRule = {
  id: string;
  matchType: CategoryRuleMatchType;
  pattern: string;
  normalizedPattern: string;
  categoryId: string;
  priority: number;
  enabled: boolean;
};

export type RuleCategorizationResult =
  | {
      status: "matched";
      normalizedMerchant: string;
      categoryId: string;
      ruleId: string;
      confidenceBasisPoints: 10_000;
      explanation: string;
    }
  | {
      status: "conflict";
      normalizedMerchant: string;
      competingRuleIds: string[];
    }
  | {
      status: "unmatched";
      normalizedMerchant: string;
    };

const MATCH_TYPE_PRECEDENCE: Record<CategoryRuleMatchType, number> = {
  exact: 3,
  starts_with: 2,
  contains: 1,
};

export function categorizeMerchantWithRules(
  merchant: string,
  rules: CategorizationRule[],
): RuleCategorizationResult {
  const normalizedMerchant = normalizeMerchant(merchant);
  if (!normalizedMerchant) {
    return { status: "unmatched", normalizedMerchant };
  }

  const matchingRules = rules
    .filter(
      (rule) =>
        rule.enabled &&
        Boolean(rule.normalizedPattern) &&
        ruleMatches(normalizedMerchant, rule),
    )
    .sort(compareRules);

  const best = matchingRules[0];
  if (!best) {
    return { status: "unmatched", normalizedMerchant };
  }

  const equallyPreferred = matchingRules.filter(
    (rule) =>
      MATCH_TYPE_PRECEDENCE[rule.matchType] ===
        MATCH_TYPE_PRECEDENCE[best.matchType] &&
      rule.priority === best.priority &&
      rule.normalizedPattern.length === best.normalizedPattern.length,
  );
  const competingCategoryIds = new Set(
    equallyPreferred.map((rule) => rule.categoryId),
  );

  if (competingCategoryIds.size > 1) {
    return {
      status: "conflict",
      normalizedMerchant,
      competingRuleIds: equallyPreferred.map((rule) => rule.id).sort(),
    };
  }

  return {
    status: "matched",
    normalizedMerchant,
    categoryId: best.categoryId,
    ruleId: best.id,
    confidenceBasisPoints: 10_000,
    explanation: `Matched ${matchTypeLabel(best.matchType)} rule “${best.pattern}”.`,
  };
}

function ruleMatches(merchant: string, rule: CategorizationRule) {
  const pattern = rule.normalizedPattern;
  if (rule.matchType === "exact") {
    return merchant === pattern;
  }
  if (rule.matchType === "starts_with") {
    return merchant === pattern || merchant.startsWith(`${pattern} `);
  }
  return merchant === pattern || ` ${merchant} `.includes(` ${pattern} `);
}

function compareRules(left: CategorizationRule, right: CategorizationRule) {
  return (
    MATCH_TYPE_PRECEDENCE[right.matchType] -
      MATCH_TYPE_PRECEDENCE[left.matchType] ||
    right.priority - left.priority ||
    right.normalizedPattern.length - left.normalizedPattern.length ||
    left.id.localeCompare(right.id)
  );
}

function matchTypeLabel(matchType: CategoryRuleMatchType) {
  if (matchType === "starts_with") return "starts-with";
  return matchType;
}
