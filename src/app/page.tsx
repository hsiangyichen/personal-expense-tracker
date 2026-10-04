import { Card, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <div>
        <p className="text-primary text-sm font-medium">Overview</p>
        <h1
          id="dashboard-heading"
          className="mt-1 text-3xl font-bold tracking-tight"
        >
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Your monthly spending summary will appear here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardTitle>Monthly spending</CardTitle>
          <p className="mt-3 text-3xl font-bold">$0.00</p>
          <p className="text-muted-foreground mt-1 text-sm">
            No expenses recorded
          </p>
        </Card>
        <Card>
          <CardTitle>Largest category</CardTitle>
          <p className="mt-3 text-3xl font-bold">—</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add an expense to begin
          </p>
        </Card>
        <Card>
          <CardTitle>Budgets</CardTitle>
          <p className="mt-3 text-3xl font-bold">0</p>
          <p className="text-muted-foreground mt-1 text-sm">
            No budgets configured
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Recent expenses</CardTitle>
        <p className="text-muted-foreground mt-4">
          Your latest expenses will be shown after you add or import them.
        </p>
      </Card>
    </section>
  );
}
