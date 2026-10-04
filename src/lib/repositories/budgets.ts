import type { BudgetInput } from "@/lib/category-budget-validation";
import { prisma } from "@/lib/prisma";

export class BudgetCategoryNotFoundError extends Error {
  constructor() {
    super("Choose an available category.");
    this.name = "BudgetCategoryNotFoundError";
  }
}

export function listBudgetsForMonth(monthKey: string) {
  return prisma.budget.findMany({
    where: { monthKey },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });
}

export function saveMonthlyBudget(input: BudgetInput) {
  return prisma.$transaction(async (transaction) => {
    const category = await transaction.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new BudgetCategoryNotFoundError();
    }

    const existing = await transaction.budget.findUnique({
      where: {
        categoryId_monthKey: {
          categoryId: input.categoryId,
          monthKey: input.monthKey,
        },
      },
      select: { id: true },
    });

    const budget = await transaction.budget.upsert({
      where: {
        categoryId_monthKey: {
          categoryId: input.categoryId,
          monthKey: input.monthKey,
        },
      },
      update: { amountMinor: input.amountMinor },
      create: input,
    });

    return { budget, created: !existing };
  });
}
