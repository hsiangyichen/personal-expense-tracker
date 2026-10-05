import { ImportReview } from "@/components/import-review";
import { listCategories } from "@/lib/repositories/categories";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const categories = await listCategories();

  return (
    <section
      aria-labelledby="import-heading"
      className="w-full max-w-[calc(100vw-2rem)] min-w-0 overflow-x-hidden sm:max-w-[calc(100vw-3rem)] lg:max-w-none"
    >
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Statements
      </p>
      <h1
        id="import-heading"
        className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
      >
        Import CSV
      </h1>
      <p className="text-muted-foreground mt-2">
        Upload and review a supported credit-card statement before saving it.
      </p>
      <ImportReview categories={categories} />
    </section>
  );
}
