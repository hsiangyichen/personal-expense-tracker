import { z } from "zod";
import { normalizeMerchant } from "@/lib/merchant-normalization";

export const CATEGORY_RULE_MATCH_TYPES = [
  "exact",
  "starts_with",
  "contains",
] as const;

export type CategoryRuleMatchType = (typeof CATEGORY_RULE_MATCH_TYPES)[number];

export type CategoryRuleInput = {
  matchType: CategoryRuleMatchType;
  pattern: string;
  categoryId: string;
  priority?: number;
  enabled?: boolean;
};

export type PreparedCategoryRuleInput = {
  matchType: CategoryRuleMatchType;
  pattern: string;
  normalizedPattern: string;
  categoryId: string;
  priority: number;
  enabled: boolean;
};

const categoryRuleMatchTypeSchema = z.enum(CATEGORY_RULE_MATCH_TYPES);

const categoryRuleSchema = z.object({
  matchType: categoryRuleMatchTypeSchema,
  pattern: z.string().trim().min(1).max(120),
  categoryId: z.string().trim().min(1),
  priority: z.number().int().min(0).max(1000).default(0),
  enabled: z.boolean().default(true),
});

export class InvalidCategoryRuleError extends Error {
  constructor() {
    super("Category rule is invalid.");
    this.name = "InvalidCategoryRuleError";
  }
}

export function parseCategoryRuleMatchType(
  value: string,
): CategoryRuleMatchType {
  const parsed = categoryRuleMatchTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new InvalidCategoryRuleError();
  }
  return parsed.data;
}

export function prepareCategoryRuleInput(
  input: CategoryRuleInput,
): PreparedCategoryRuleInput {
  const parsed = categoryRuleSchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidCategoryRuleError();
  }

  const normalizedPattern = normalizeMerchant(parsed.data.pattern);
  if (!normalizedPattern || normalizedPattern.length > 120) {
    throw new InvalidCategoryRuleError();
  }

  return {
    ...parsed.data,
    normalizedPattern,
  };
}
