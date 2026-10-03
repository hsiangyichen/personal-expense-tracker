export type DashboardTransaction = {
  id: string;
  transactionDate: string;
  spendingAmountMinor: number;
  merchant: string;
  kind: string;
  createdAt: Date;
  category: {
    id: string;
    name: string;
    color: string;
  } | null;
};

export type CategoryTotal = {
  categoryId: string;
  name: string;
  color: string | null;
  amountMinor: bigint;
};

export type DashboardSummary = {
  monthlyTotalMinor: bigint;
  categoryTotals: CategoryTotal[];
  largestCategories: CategoryTotal[];
  recentTransactions: DashboardTransaction[];
  transactionCount: number;
};

const RECENT_TRANSACTION_LIMIT = 5;

export function calculateDashboard(
  transactions: DashboardTransaction[],
): DashboardSummary {
  let monthlyTotalMinor = 0n;
  const categoryAmounts = new Map<string, CategoryTotal>();

  for (const transaction of transactions) {
    const amountMinor = BigInt(transaction.spendingAmountMinor);
    monthlyTotalMinor += amountMinor;

    if (amountMinor === 0n) {
      continue;
    }

    const categoryId = transaction.category?.id ?? "uncategorized";
    const existing = categoryAmounts.get(categoryId);

    categoryAmounts.set(categoryId, {
      categoryId,
      name: transaction.category?.name ?? "Uncategorized",
      color: transaction.category?.color ?? null,
      amountMinor: (existing?.amountMinor ?? 0n) + amountMinor,
    });
  }

  const categoryTotals = [...categoryAmounts.values()]
    .filter((category) => category.amountMinor !== 0n)
    .sort(compareCategoryTotals);
  const largestAmount = categoryTotals.find(
    (category) => category.amountMinor > 0n,
  )?.amountMinor;
  const largestCategories = largestAmount
    ? categoryTotals.filter(
        (category) => category.amountMinor === largestAmount,
      )
    : [];
  const recentTransactions = transactions
    .filter((transaction) => transaction.spendingAmountMinor !== 0)
    .sort((left, right) => {
      const dateOrder = right.transactionDate.localeCompare(
        left.transactionDate,
      );
      return dateOrder || right.createdAt.getTime() - left.createdAt.getTime();
    })
    .slice(0, RECENT_TRANSACTION_LIMIT);

  return {
    monthlyTotalMinor,
    categoryTotals,
    largestCategories,
    recentTransactions,
    transactionCount: transactions.filter(
      (transaction) => transaction.spendingAmountMinor !== 0,
    ).length,
  };
}

function compareCategoryTotals(left: CategoryTotal, right: CategoryTotal) {
  if (left.amountMinor !== right.amountMinor) {
    return left.amountMinor > right.amountMinor ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}
