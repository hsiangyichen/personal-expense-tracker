import { describe, expect, it } from "vitest";
import {
  budgetBarPercentage,
  calculateBudgetProgress,
  type BudgetForProgress,
} from "@/lib/budget-progress";
import type { CategoryTotal } from "@/lib/dashboard";

const budget: BudgetForProgress = {
  categoryId: "groceries",
  amountMinor: 10_000,
  category: { name: "Groceries", color: "#15803d" },
};

function spending(amountMinor: bigint): CategoryTotal[] {
  return [
    {
      categoryId: "groceries",
      name: "Groceries",
      color: "#15803d",
      amountMinor,
    },
  ];
}

describe("budget progress", () => {
  it("reports the full budget remaining with no spending", () => {
    const [progress] = calculateBudgetProgress([budget], []);

    expect(progress).toMatchObject({
      usedMinor: 0n,
      remainingMinor: 10_000n,
      percentageUsed: 0,
      exceeded: false,
    });
  });

  it("uses net spending after confirmed refunds", () => {
    const [progress] = calculateBudgetProgress([budget], spending(7_000n));

    expect(progress).toMatchObject({
      usedMinor: 7_000n,
      remainingMinor: 3_000n,
      percentageUsed: 70,
      exceeded: false,
    });
  });

  it("handles a refund-only month without drawing a negative bar", () => {
    const [progress] = calculateBudgetProgress([budget], spending(-500n));

    expect(progress).toMatchObject({
      usedMinor: -500n,
      remainingMinor: 10_500n,
      percentageUsed: -5,
      exceeded: false,
    });
    expect(budgetBarPercentage(progress)).toBe(0);
  });

  it("reports an exact budget limit without marking it exceeded", () => {
    const [progress] = calculateBudgetProgress([budget], spending(10_000n));

    expect(progress).toMatchObject({
      remainingMinor: 0n,
      percentageUsed: 100,
      exceeded: false,
    });
    expect(budgetBarPercentage(progress)).toBe(100);
  });

  it("reports an exceeded budget and clamps the visual bar", () => {
    const [progress] = calculateBudgetProgress([budget], spending(12_500n));

    expect(progress).toMatchObject({
      remainingMinor: -2_500n,
      percentageUsed: 125,
      exceeded: true,
    });
    expect(budgetBarPercentage(progress)).toBe(100);
  });
});
