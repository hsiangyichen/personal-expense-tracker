import type { CategoryTotal } from "@/lib/dashboard";

export type BudgetForProgress = {
  categoryId: string;
  amountMinor: number;
  category: {
    name: string;
    color: string;
  };
};

export type BudgetProgress = {
  categoryId: string;
  categoryName: string;
  color: string;
  budgetMinor: bigint;
  usedMinor: bigint;
  remainingMinor: bigint;
  percentageUsed: number;
  exceeded: boolean;
};

export function calculateBudgetProgress(
  budgets: BudgetForProgress[],
  categoryTotals: CategoryTotal[],
): BudgetProgress[] {
  const spendingByCategory = new Map(
    categoryTotals.map((category) => [
      category.categoryId,
      category.amountMinor,
    ]),
  );

  return budgets
    .map((budget) => {
      const budgetMinor = BigInt(budget.amountMinor);
      const usedMinor = spendingByCategory.get(budget.categoryId) ?? 0n;
      const remainingMinor = budgetMinor - usedMinor;
      const percentageUsed = Number((usedMinor * 10_000n) / budgetMinor) / 100;

      return {
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        color: budget.category.color,
        budgetMinor,
        usedMinor,
        remainingMinor,
        percentageUsed,
        exceeded: remainingMinor < 0n,
      };
    })
    .sort((left, right) => left.categoryName.localeCompare(right.categoryName));
}

export function budgetBarPercentage(progress: BudgetProgress) {
  return Math.max(0, Math.min(progress.percentageUsed, 100));
}
