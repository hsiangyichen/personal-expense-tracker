import { Prisma } from "@prisma/client";
import {
  parseCategoryRuleMatchType,
  prepareCategoryRuleInput,
  type CategoryRuleInput,
  type CategoryRuleMatchType,
} from "@/lib/category-rule-validation";
import { prisma } from "@/lib/prisma";

export class DuplicateCategoryRuleError extends Error {
  constructor() {
    super("A rule with this match type and merchant pattern already exists.");
    this.name = "DuplicateCategoryRuleError";
  }
}

export class CategoryRuleCategoryNotFoundError extends Error {
  constructor() {
    super("Choose an available category.");
    this.name = "CategoryRuleCategoryNotFoundError";
  }
}

export class CategoryRuleNotFoundError extends Error {
  constructor() {
    super("Category rule was not found.");
    this.name = "CategoryRuleNotFoundError";
  }
}

export async function listCategoryRules({ enabledOnly = false } = {}) {
  const rules = await prisma.categoryRule.findMany({
    where: enabledOnly ? { enabled: true } : undefined,
    include: { category: true },
    orderBy: [
      { priority: "desc" },
      { matchType: "asc" },
      { normalizedPattern: "asc" },
    ],
  });
  return rules.map(withTypedMatchType);
}

export async function createCategoryRule(input: CategoryRuleInput) {
  const prepared = prepareCategoryRuleInput(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      await requireCategory(transaction, prepared.categoryId);
      const rule = await transaction.categoryRule.create({
        data: {
          ...prepared,
          source: "user",
        },
        include: { category: true },
      });
      return withTypedMatchType(rule);
    });
  } catch (error) {
    throw translateUniqueConstraint(error);
  }
}

export async function updateCategoryRule(id: string, input: CategoryRuleInput) {
  const prepared = prepareCategoryRuleInput(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      await requireRule(transaction, id);
      await requireCategory(transaction, prepared.categoryId);
      const rule = await transaction.categoryRule.update({
        where: { id },
        data: prepared,
        include: { category: true },
      });
      return withTypedMatchType(rule);
    });
  } catch (error) {
    throw translateUniqueConstraint(error);
  }
}

export async function setCategoryRuleEnabled(id: string, enabled: boolean) {
  const updated = await prisma.categoryRule.updateMany({
    where: { id },
    data: { enabled },
  });
  if (updated.count === 0) {
    throw new CategoryRuleNotFoundError();
  }
}

export async function deleteCategoryRule(id: string) {
  const deleted = await prisma.categoryRule.deleteMany({ where: { id } });
  if (deleted.count === 0) {
    throw new CategoryRuleNotFoundError();
  }
}

async function requireCategory(
  transaction: Prisma.TransactionClient,
  categoryId: string,
) {
  const category = await transaction.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new CategoryRuleCategoryNotFoundError();
  }
}

async function requireRule(transaction: Prisma.TransactionClient, id: string) {
  const rule = await transaction.categoryRule.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!rule) {
    throw new CategoryRuleNotFoundError();
  }
}

function withTypedMatchType<T extends { matchType: string }>(
  rule: T,
): Omit<T, "matchType"> & { matchType: CategoryRuleMatchType } {
  return {
    ...rule,
    matchType: parseCategoryRuleMatchType(rule.matchType),
  };
}

function translateUniqueConstraint(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new DuplicateCategoryRuleError();
  }
  return error;
}
