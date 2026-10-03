import { describe, expect, it } from "vitest";
import { calculateDashboard, type DashboardTransaction } from "@/lib/dashboard";

const groceries = {
  id: "groceries",
  name: "Groceries",
  color: "#15803d",
};
const dining = { id: "dining", name: "Dining", color: "#c2410c" };

function transaction(
  values: Partial<DashboardTransaction> &
    Pick<DashboardTransaction, "id" | "spendingAmountMinor">,
): DashboardTransaction {
  return {
    transactionDate: "2026-08-15",
    merchant: `Merchant ${values.id}`,
    kind: "expense",
    createdAt: new Date("2026-08-15T12:00:00Z"),
    category: groceries,
    ...values,
  };
}

describe("dashboard calculations", () => {
  it("uses purchases, refunds, and zero-effect payments in the monthly total", () => {
    const summary = calculateDashboard([
      transaction({
        id: "purchase",
        kind: "expense",
        spendingAmountMinor: 5_000,
      }),
      transaction({
        id: "refund",
        kind: "refund",
        spendingAmountMinor: -1_200,
      }),
      transaction({
        id: "payment",
        kind: "payment",
        spendingAmountMinor: 0,
        category: null,
      }),
    ]);

    expect(summary.monthlyTotalMinor).toBe(3_800n);
    expect(summary.categoryTotals).toEqual([
      expect.objectContaining({ name: "Groceries", amountMinor: 3_800n }),
    ]);
    expect(summary.transactionCount).toBe(2);
  });

  it("identifies every category tied for the largest positive total", () => {
    const summary = calculateDashboard([
      transaction({ id: "groceries", spendingAmountMinor: 2_500 }),
      transaction({
        id: "dining",
        spendingAmountMinor: 2_500,
        category: dining,
      }),
    ]);

    expect(summary.largestCategories.map((category) => category.name)).toEqual([
      "Dining",
      "Groceries",
    ]);
  });

  it("reports no largest category for an empty or refund-only month", () => {
    expect(calculateDashboard([]).largestCategories).toEqual([]);
    expect(
      calculateDashboard([
        transaction({ id: "refund", spendingAmountMinor: -500 }),
      ]).largestCategories,
    ).toEqual([]);
  });

  it("keeps exact totals beyond the range of one database integer", () => {
    const summary = calculateDashboard([
      transaction({ id: "first", spendingAmountMinor: 2_147_483_647 }),
      transaction({ id: "second", spendingAmountMinor: 2_147_483_647 }),
    ]);

    expect(summary.monthlyTotalMinor).toBe(4_294_967_294n);
  });

  it("returns the five most recent spending transactions", () => {
    const transactions = Array.from({ length: 7 }, (_, index) =>
      transaction({
        id: String(index + 1),
        spendingAmountMinor: index === 0 ? 0 : 100,
        transactionDate: `2026-08-${String(index + 1).padStart(2, "0")}`,
      }),
    );

    expect(
      calculateDashboard(transactions).recentTransactions.map(({ id }) => id),
    ).toEqual(["7", "6", "5", "4", "3"]);
  });
});
