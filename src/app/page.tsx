import Link from "next/link";
import {
  budgetBarPercentage,
  calculateBudgetProgress,
  type BudgetProgress,
} from "@/lib/budget-progress";
import { Card, CardTitle } from "@/components/ui/card";
import {
  calculateDashboard,
  type CategoryTotal,
  type DashboardTransaction,
} from "@/lib/dashboard";
import { currentMonthKey, isValidMonthKey } from "@/lib/expense-validation";
import { formatCadFromCents } from "@/lib/money";
import { listBudgetsForMonth } from "@/lib/repositories/budgets";
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
  const [transactions, budgets] = await Promise.all([
    listTransactionsForMonth(month),
    listBudgetsForMonth(month),
  ]);
  const summary = calculateDashboard(transactions);
  const budgetProgress = calculateBudgetProgress(
    budgets,
    summary.categoryTotals,
  );
  const monthLabel = formatMonthLabel(month);
  const largestCategory = summarizeLargestCategory(summary.largestCategories);
  const budgetRemainingMinor = budgetProgress.reduce(
    (total, progress) => total + progress.remainingMinor,
    0n,
  );

  return (
    <section aria-labelledby="dashboard-heading" className="min-w-0 space-y-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
            Overview
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
            id="dashboard-heading"
          >
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Spending summary for {monthLabel}.
          </p>
        </div>

        <form
          action="/"
          className="bg-card flex w-fit max-w-full items-end gap-2 rounded-xl border p-1.5 shadow-sm"
          method="get"
        >
          <div className="min-w-0">
            <label className="sr-only" htmlFor="dashboard-month">
              Month
            </label>
            <input
              className="min-h-10 min-w-0 rounded-lg border-0 bg-transparent px-2 text-sm font-medium sm:px-3"
              defaultValue={month}
              id="dashboard-month"
              name="month"
              required
              type="month"
            />
          </div>
          <button
            className="bg-primary text-primary-foreground inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold shadow-sm hover:bg-blue-700 sm:px-4"
            type="submit"
          >
            View month
          </button>
        </form>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Net of confirmed refunds"
          label="Monthly spending"
          value={formatCadFromCents(summary.monthlyTotalMinor)}
        />
        <MetricCard
          detail={
            budgetProgress.length === 0
              ? "Set budgets to track this total"
              : `Across ${budgetProgress.length} ${budgetProgress.length === 1 ? "category" : "categories"}`
          }
          label="Budget remaining"
          value={
            budgetProgress.length === 0
              ? "—"
              : formatCadFromCents(budgetRemainingMinor)
          }
        />
        <MetricCard
          detail={largestCategory.detail}
          label="Largest category"
          value={largestCategory.value}
        />
        <MetricCard
          detail="Expenses and counted refunds"
          label="Spending activity"
          value={summary.transactionCount.toString()}
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)]">
        <BudgetHealthCard progress={budgetProgress} month={month} />
        <CategoryDistributionCard categories={summary.categoryTotals} />
      </div>

      <RecentExpensesCard
        month={month}
        transactions={summary.recentTransactions}
      />
    </section>
  );
}

function MetricCard({
  detail,
  label,
  value,
}: Readonly<{ detail: string; label: string; value: string }>) {
  return (
    <Card className="min-w-0">
      <CardTitle className="text-muted-foreground text-sm font-bold tracking-normal">
        {label}
      </CardTitle>
      <p className="mt-3 text-2xl font-bold tracking-tight break-words tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1.5 truncate text-sm">{detail}</p>
    </Card>
  );
}

function BudgetHealthCard({
  month,
  progress,
}: Readonly<{ month: string; progress: BudgetProgress[] }>) {
  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>Budget health</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Monthly limits at a glance
          </p>
        </div>
        <Link
          className="text-primary shrink-0 text-sm font-semibold hover:underline"
          href={`/categories?month=${month}`}
        >
          Manage
        </Link>
      </div>

      {progress.length === 0 ? (
        <EmptyState message="Set a monthly budget to track progress." />
      ) : (
        <ul className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
          {progress.map((item) => {
            const visualPercentage = budgetBarPercentage(item);
            return (
              <li
                className="bg-background min-w-0 rounded-xl p-4"
                key={item.categoryId}
              >
                <div className="flex min-w-0 items-center justify-between gap-3 text-sm font-semibold">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.categoryName}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {Math.round(item.percentageUsed)}%
                  </span>
                </div>
                <div
                  aria-label={`${item.categoryName} budget`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={visualPercentage}
                  aria-valuetext={`${formatCadFromCents(item.usedMinor)} used of ${formatCadFromCents(item.budgetMinor)}`}
                  className="bg-muted mt-3 h-2 overflow-hidden rounded-full"
                  role="progressbar"
                >
                  <div
                    className={
                      item.exceeded
                        ? "h-full rounded-full bg-red-600"
                        : "from-primary to-accent h-full rounded-full bg-gradient-to-r"
                    }
                    style={{ width: `${visualPercentage}%` }}
                  />
                </div>
                <div className="text-muted-foreground mt-2 flex flex-wrap justify-between gap-1 text-xs tabular-nums">
                  <span>Used {formatCadFromCents(item.usedMinor)}</span>
                  <span>Limit {formatCadFromCents(item.budgetMinor)}</span>
                </div>
                <p
                  className={`mt-1 text-xs font-semibold tabular-nums ${
                    item.exceeded ? "text-red-700" : "text-muted-foreground"
                  }`}
                >
                  {item.exceeded
                    ? `Over by ${formatCadFromCents(-item.remainingMinor)}`
                    : `Remaining ${formatCadFromCents(item.remainingMinor)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function CategoryDistributionCard({
  categories,
}: Readonly<{ categories: CategoryTotal[] }>) {
  const positiveCategories = categories.filter(
    (category) => category.amountMinor > 0n,
  );

  return (
    <Card className="min-w-0">
      <CardTitle>Category breakdown</CardTitle>
      <p className="text-muted-foreground mt-1 text-sm">
        Spending distribution for this month
      </p>

      {positiveCategories.length === 0 ? (
        <EmptyState message="Add an expense to see category totals." />
      ) : (
        <div className="mt-5 grid items-center gap-6 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <div
            aria-label="Spending by category chart"
            className="relative mx-auto size-32 rounded-full sm:size-36"
            role="img"
            style={{
              background: categoryChartBackground(positiveCategories),
            }}
          >
            <span
              aria-hidden="true"
              className="bg-card absolute inset-7 rounded-full"
            />
          </div>
          <ul className="min-w-0 divide-y">
            {positiveCategories.slice(0, 4).map((category) => (
              <li
                className="flex min-w-0 items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                key={category.categoryId}
              >
                <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: category.color ?? "var(--accent)",
                    }}
                  />
                  <span className="truncate">{category.name}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {formatCadFromCents(category.amountMinor)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function RecentExpensesCard({
  month,
  transactions,
}: Readonly<{ month: string; transactions: DashboardTransaction[] }>) {
  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>Recent activity</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Latest included expenses and refunds
          </p>
        </div>
        <Link
          className="text-primary shrink-0 text-sm font-semibold hover:underline"
          href={`/expenses?month=${month}`}
        >
          View all
        </Link>
      </div>

      {transactions.length === 0 ? (
        <EmptyState message="No spending activity for this month." />
      ) : (
        <>
          <ul className="mt-4 grid gap-3 md:hidden">
            {transactions.map((transaction) => (
              <li
                className="bg-background min-w-0 rounded-xl p-4"
                key={transaction.id}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold">
                      {merchantInitials(transaction.merchant)}
                    </span>
                    <span className="min-w-0 font-semibold break-words">
                      {transaction.merchant}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      transaction.spendingAmountMinor < 0 ? "text-success" : ""
                    }`}
                  >
                    {formatCadFromCents(transaction.spendingAmountMinor)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  {transaction.category?.name ?? "Uncategorized"} ·{" "}
                  {formatDisplayDate(transaction.transactionDate)}
                  {transaction.kind === "refund" ? " · Refund" : ""}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
                  <th className="px-3 py-3 font-bold" scope="col">
                    Merchant
                  </th>
                  <th className="px-3 py-3 font-bold" scope="col">
                    Category
                  </th>
                  <th className="px-3 py-3 font-bold" scope="col">
                    Date
                  </th>
                  <th className="px-3 py-3 text-right font-bold" scope="col">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    className="border-t border-slate-100"
                    key={transaction.id}
                  >
                    <td className="px-3 py-3.5">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold">
                          {merchantInitials(transaction.merchant)}
                        </span>
                        <span className="truncate font-semibold">
                          {transaction.merchant}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {transaction.category?.name ?? "Uncategorized"}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      {formatDisplayDate(transaction.transactionDate)}
                    </td>
                    <td
                      className={`px-3 py-3.5 text-right font-bold whitespace-nowrap tabular-nums ${
                        transaction.spendingAmountMinor < 0
                          ? "text-success"
                          : ""
                      }`}
                    >
                      {formatCadFromCents(transaction.spendingAmountMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function EmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <p className="text-muted-foreground bg-background mt-4 rounded-xl p-6 text-center text-sm">
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

function categoryChartBackground(categories: CategoryTotal[]) {
  const total = categories.reduce(
    (sum, category) => sum + category.amountMinor,
    0n,
  );
  let start = 0;
  const segments = categories.map((category) => {
    const percentage = Number((category.amountMinor * 10_000n) / total) / 100;
    const end = start + percentage;
    const segment = `${category.color ?? "var(--accent)"} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function merchantInitials(merchant: string) {
  return merchant
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function formatDisplayDate(dateOnly: string) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
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
