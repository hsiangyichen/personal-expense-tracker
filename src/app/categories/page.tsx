export default function CategoriesPage() {
  return (
    <section aria-labelledby="categories-heading">
      <p className="text-primary text-sm font-medium">Planning</p>
      <h1
        id="categories-heading"
        className="mt-1 text-3xl font-bold tracking-tight"
      >
        Categories &amp; budgets
      </h1>
      <p className="text-muted-foreground mt-2">
        Organize spending categories and set monthly limits here.
      </p>
    </section>
  );
}
