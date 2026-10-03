export default function ExpensesPage() {
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
        Add, search, and filter expenses from this screen.
      </p>
    </section>
  );
}
