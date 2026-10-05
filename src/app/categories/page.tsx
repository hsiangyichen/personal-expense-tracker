import { BudgetForm } from "@/components/budget-form";
import { CategoryForm } from "@/components/category-form";
import { Card, CardTitle } from "@/components/ui/card";
import { currentMonthKey, isValidMonthKey } from "@/lib/expense-validation";
import { formatCadFromCents } from "@/lib/money";
import { listBudgetsForMonth } from "@/lib/repositories/budgets";
import { listCategories } from "@/lib/repositories/categories";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type CategoriesPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const parameters = await searchParams;
  const requestedMonth = singleValue(parameters.month);
  const month =
    requestedMonth && isValidMonthKey(requestedMonth)
      ? requestedMonth
      : currentMonthKey();
  const [categories, budgets] = await Promise.all([
    listCategories(),
    listBudgetsForMonth(month),
  ]);
  const budgetsByCategory = new Map(
    budgets.map((budget) => [budget.categoryId, budget]),
  );
  const statusMessage = getStatusMessage(parameters);

  return (
    <section aria-labelledby="categories-heading" className="min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
            Planning
          </p>
          <h1
            id="categories-heading"
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Categories &amp; budgets
          </h1>
          <p className="text-muted-foreground mt-2">
            Create spending categories and set monthly limits in CAD.
          </p>
        </div>

        <form
          action="/categories"
          className="bg-card grid w-full grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl border p-1.5 shadow-sm sm:w-fit"
          method="get"
        >
          <div className="min-w-0">
            <label className="text-sm font-medium" htmlFor="budget-month">
              Budget month
            </label>
            <input
              className="bg-card focus:border-primary mt-1 min-h-11 w-full min-w-0 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100"
              defaultValue={month}
              id="budget-month"
              name="month"
              required
              type="month"
            />
          </div>
          <button
            className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-700"
            type="submit"
          >
            View month
          </button>
        </form>
      </div>

      {statusMessage ? (
        <p
          className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)] lg:items-start">
        <Card className="order-2 min-w-0 lg:order-1">
          <CardTitle>Create category</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a category for expenses, imports, and budgets.
          </p>
          <CategoryForm month={month} />

          <h2 className="mt-7 font-semibold">Available categories</h2>
          <ul className="mt-3 divide-y">
            {categories.map((category) => (
              <li className="flex items-center gap-3 py-3" key={category.id}>
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="min-w-0 break-words">{category.name}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="order-1 min-w-0 lg:order-2">
          <CardTitle>Budgets for {formatMonthLabel(month)}</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Saving again updates the existing category budget for this month.
          </p>
          <ul className="mt-5 grid min-w-0 gap-3">
            {categories.map((category) => {
              const budget = budgetsByCategory.get(category.id);
              return (
                <li
                  className="bg-background min-w-0 rounded-xl p-4"
                  key={category.id}
                >
                  <div className="flex min-w-0 items-center justify-between gap-4">
                    <span className="flex min-w-0 items-center gap-3 font-medium">
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="min-w-0 break-words">
                        {category.name}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                      {budget
                        ? formatCadFromCents(budget.amountMinor)
                        : "No budget"}
                    </span>
                  </div>
                  <BudgetForm
                    amountMinor={budget?.amountMinor}
                    categoryId={category.id}
                    categoryName={category.name}
                    month={month}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </section>
  );
}

function getStatusMessage(parameters: SearchParams) {
  const saved = singleValue(parameters.saved);
  if (saved === "category") return "Category created.";
  if (saved === "budget-created") return "Budget created.";
  if (saved === "budget-updated") return "Budget updated.";
  return null;
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
