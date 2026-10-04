import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { calculateDashboard } from "@/lib/dashboard";
import { currentMonthKey, isValidMonthKey } from "@/lib/expense-validation";
import { formatCadFromCents } from "@/lib/money";
import { listTransactionsForMonth } from "@/lib/repositories/transactions";

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const parameters = await searchParams;
  const requestedMonth = singleValue(parameters.month);
  const month =
    requestedMonth && isValidMonthKey(requestedMonth)
      ? requestedMonth
      : currentMonthKey();
  const transactions = await listTransactionsForMonth(month);
  const summary = calculateDashboard(transactions);
  const monthLabel = formatMonthLabel(month);
  const largestCategory = summarizeLargestCategory(summary.largestCategories);

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-sm font-medium">Overview</p>
          <h1
            id="dashboard-heading"
            className="mt-1 text-3xl font-bold tracking-tight"
          >
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Spending summary for {monthLabel}.
          </p>
        </div>

        <form action="/" className="flex items-end gap-2" method="get">
          <div>
            <label className="text-sm font-medium" htmlFor="dashboard-month">
              Month
            </label>
            <input
              className="bg-card mt-1 min-h-11 rounded-md border px-3 py-2 text-sm"
              defaultValue={month}
              id="dashboard-month"
              name="month"
              required
              type="month"
            />
          </div>
          <button
            className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
            type="submit"
          >
            View month
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardTitle>Monthly spending</CardTitle>
          <p className="mt-3 text-3xl font-bold tabular-nums">
            {formatCadFromCents(summary.monthlyTotalMinor)}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Net of confirmed refunds
          </p>
        </Card>
        <Card>
          <CardTitle>Largest category</CardTitle>
          <p className="mt-3 text-2xl font-bold">{largestCategory.value}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {largestCategory.detail}
          </p>
        </Card>
        <Card>
          <CardTitle>Recent expenses</CardTitle>
          <p className="mt-3 text-3xl font-bold tabular-nums">
            {summary.transactionCount}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {summary.transactionCount === 1
              ? "Spending transaction this month"
              : "Spending transactions this month"}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardTitle>Category breakdown</CardTitle>
          {summary.categoryTotals.length === 0 ? (
            <EmptyState message="Add an expense to see category totals." />
          ) : (
            <ul className="mt-4 divide-y">
              {summary.categoryTotals.map((category) => (
                <li
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  key={category.categoryId}
                >
                  <span className="flex min-w-0 items-center gap-3 font-medium">
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: category.color ?? "currentColor",
                      }}
                    />
                    <span className="truncate">{category.name}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCadFromCents(category.amountMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Recent expenses</CardTitle>
            <Link
              className="text-primary text-sm font-medium hover:underline"
              href={`/expenses?month=${month}`}
            >
              View all
            </Link>
          </div>
          {summary.recentTransactions.length === 0 ? (
            <EmptyState message="No spending activity for this month." />
          ) : (
            <ul className="mt-4 divide-y">
              {summary.recentTransactions.map((transaction) => (
                <li
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  key={transaction.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {transaction.merchant}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-sm">
                      {transaction.transactionDate}
                      {transaction.kind === "refund" ? " · Refund" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCadFromCents(transaction.spendingAmountMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

function EmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <p className="text-muted-foreground mt-4 rounded-lg border border-dashed p-6 text-center text-sm">
      {message}
    </p>
  );
}

function summarizeLargestCategory(
  categories: ReturnType<typeof calculateDashboard>["largestCategories"],
) {
  if (categories.length === 0) {
    return { value: "—", detail: "No positive spending this month" };
  }

  const amount = formatCadFromCents(categories[0].amountMinor);
  if (categories.length === 1) {
    return { value: categories[0].name, detail: amount };
  }

  return {
    value: `${categories.length}-way tie`,
    detail: `${categories.map((category) => category.name).join(", ")} · ${amount} each`,
  };
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
