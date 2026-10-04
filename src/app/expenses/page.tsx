import Link from "next/link";
import { DeleteExpenseButton } from "@/components/delete-expense-button";
import { ExpenseForm } from "@/components/expense-form";
import { Card, CardTitle } from "@/components/ui/card";
import { currentMonthKey, isValidMonthKey } from "@/lib/expense-validation";
import { formatCadFromCents } from "@/lib/money";
import { listCategories } from "@/lib/repositories/categories";
import { findExpenseById, listExpenses } from "@/lib/repositories/transactions";

type SearchParams = Record<string, string | string[] | undefined>;
type ExpensesPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function ExpensesPage({
  searchParams,
}: ExpensesPageProps) {
  const parameters = await searchParams;
  const requestedMonth = singleValue(parameters.month);
  const month =
    requestedMonth && isValidMonthKey(requestedMonth)
      ? requestedMonth
      : currentMonthKey();
  const categoryId = singleValue(parameters.category)?.trim() || undefined;
  const search =
    singleValue(parameters.search)?.trim().slice(0, 100) || undefined;
  const editId = singleValue(parameters.edit)?.trim() || undefined;

  const [categories, expenses, requestedExpense] = await Promise.all([
    listCategories(),
    listExpenses({ monthKey: month, categoryId, search }),
    editId ? findExpenseById(editId) : Promise.resolve(null),
  ]);
  const editedExpense =
    requestedExpense?.source === "manual" ? requestedExpense : undefined;
  const filterHref = buildExpensesHref({ month, categoryId, search });
  const statusMessage = getStatusMessage(parameters);

  return (
    <section aria-labelledby="expenses-heading">
      <p className="text-primary text-sm font-medium">Transactions</p>
      <h1
        id="expenses-heading"
        className="mt-1 text-3xl font-bold tracking-tight"
      >
        Expenses
      </h1>
      <p className="text-muted-foreground mt-2">
        Add, search, and filter manual expenses in CAD.
      </p>

      {statusMessage ? (
        <p
          className="mt-5 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}

      {editId && !editedExpense ? (
        <p
          className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          This manual expense is no longer available.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)] lg:items-start">
        <Card className="min-w-0">
          <CardTitle>Expense list</CardTitle>
          <form
            action="/expenses"
            className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            method="get"
          >
            <div>
              <label className="text-sm font-medium" htmlFor="month">
                Month
              </label>
              <input
                className="bg-card mt-1 min-h-11 w-full rounded-md border px-3 py-2 text-sm"
                defaultValue={month}
                id="month"
                name="month"
                required
                type="month"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="category">
                Category
              </label>
              <select
                className="bg-card mt-1 min-h-11 w-full rounded-md border px-3 py-2 text-sm"
                defaultValue={categoryId ?? ""}
                id="category"
                name="category"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 xl:col-span-1">
              <label className="text-sm font-medium" htmlFor="search">
                Merchant or details
              </label>
              <input
                className="bg-card mt-1 min-h-11 w-full rounded-md border px-3 py-2 text-sm"
                defaultValue={search}
                id="search"
                maxLength={100}
                name="search"
                placeholder="Search expenses"
                type="search"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                className="bg-primary text-primary-foreground inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
                type="submit"
              >
                Apply filters
              </button>
              <Link
                className="bg-card hover:bg-muted inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
                href={`/expenses?month=${month}`}
              >
                Clear
              </Link>
            </div>
          </form>

          <p className="text-muted-foreground mt-4 text-sm" role="status">
            {expenses.length === 1
              ? "1 expense"
              : `${expenses.length} expenses`}
          </p>

          {expenses.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">No expenses found</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Add an expense or change the filters.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-3 font-medium" scope="col">
                      Date
                    </th>
                    <th className="px-3 py-3 font-medium" scope="col">
                      Merchant
                    </th>
                    <th className="px-3 py-3 font-medium" scope="col">
                      Category
                    </th>
                    <th
                      className="px-3 py-3 text-right font-medium"
                      scope="col"
                    >
                      Amount
                    </th>
                    <th className="px-3 py-3 font-medium" scope="col">
                      Source
                    </th>
                    <th
                      className="px-3 py-3 text-right font-medium"
                      scope="col"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr className="border-b last:border-0" key={expense.id}>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {expense.transactionDate}
                      </td>
                      <td className="px-3 py-4 font-medium">
                        {expense.merchant}
                      </td>
                      <td className="px-3 py-4">
                        {expense.category?.name ?? "Uncategorized"}
                      </td>
                      <td className="px-3 py-4 text-right whitespace-nowrap tabular-nums">
                        {formatCadFromCents(expense.spendingAmountMinor)}
                      </td>
                      <td className="px-3 py-4 capitalize">{expense.source}</td>
                      <td className="px-3 py-4 text-right">
                        {expense.source === "manual" ? (
                          <div className="flex justify-end gap-2">
                            <Link
                              aria-label={`Edit ${expense.merchant}`}
                              className="bg-card hover:bg-muted inline-flex min-h-9 items-center justify-center rounded-md border px-3 py-1 text-sm font-medium"
                              href={buildExpensesHref({
                                month,
                                categoryId,
                                search,
                                edit: expense.id,
                              })}
                            >
                              Edit
                            </Link>
                            <DeleteExpenseButton
                              expenseId={expense.id}
                              merchant={expense.merchant}
                              month={month}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>
            {editedExpense ? "Edit expense" : "Add expense"}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {editedExpense
              ? "Update this manual expense."
              : "Record one manual expense."}
          </p>
          <ExpenseForm
            cancelHref={filterHref}
            categories={categories}
            expense={editedExpense}
            key={editedExpense?.id ?? "new"}
          />
        </Card>
      </div>
    </section>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildExpensesHref({
  month,
  categoryId,
  search,
  edit,
}: {
  month: string;
  categoryId?: string;
  search?: string;
  edit?: string;
}) {
  const parameters = new URLSearchParams({ month });
  if (categoryId) {
    parameters.set("category", categoryId);
  }
  if (search) {
    parameters.set("search", search);
  }
  if (edit) {
    parameters.set("edit", edit);
  }
  return `/expenses?${parameters.toString()}`;
}

function getStatusMessage(parameters: SearchParams) {
  const saved = singleValue(parameters.saved);
  if (saved === "created") {
    return "Expense added.";
  }
  if (saved === "updated") {
    return "Expense updated.";
  }
  if (singleValue(parameters.deleted) === "1") {
    return "Expense deleted.";
  }
  return null;
}
