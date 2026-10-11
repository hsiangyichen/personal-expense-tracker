"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  createCategoryRuleAction,
  deleteCategoryRuleAction,
  setCategoryRuleEnabledAction,
  type CategoryRuleActionState,
} from "@/app/categories/actions";
import { Button } from "@/components/ui/button";
import type { CategoryRuleMatchType } from "@/lib/category-rule-validation";

type CategoryOption = {
  id: string;
  name: string;
};

type CategoryRuleItem = {
  id: string;
  matchType: CategoryRuleMatchType;
  pattern: string;
  priority: number;
  enabled: boolean;
  categoryName: string;
};

export function CategoryRuleManager({
  categories,
  rules,
}: Readonly<{
  categories: CategoryOption[];
  rules: CategoryRuleItem[];
}>) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<CategoryRuleActionState>({});
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<CategoryRuleActionState>) {
    setState({});
    startTransition(async () => {
      const response = await action();
      setState(response);
      if (response.success) router.refresh();
    });
  }

  return (
    <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
      <form
        className="bg-background rounded-xl p-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          run(async () => {
            const response = await createCategoryRuleAction(formData);
            if (response.success) formRef.current?.reset();
            return response;
          });
        }}
        ref={formRef}
      >
        <h3 className="font-bold">Add a merchant rule</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose how a merchant name should match future transactions.
        </p>

        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="rule-pattern">
            Merchant pattern
          </label>
          <input
            className="bg-card focus:border-primary mt-1 min-h-11 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100"
            id="rule-pattern"
            maxLength={120}
            name="pattern"
            placeholder="Example: Illustrative Grocery"
            required
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="rule-match-type">
              Match when merchant
            </label>
            <select
              className="bg-card focus:border-primary mt-1 min-h-11 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100"
              defaultValue="exact"
              id="rule-match-type"
              name="matchType"
            >
              <option value="exact">Exactly matches</option>
              <option value="starts_with">Starts with</option>
              <option value="contains">Contains</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="rule-category">
              Category
            </label>
            <select
              className="bg-card focus:border-primary mt-1 min-h-11 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100"
              defaultValue=""
              id="rule-category"
              name="categoryId"
              required
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button className="mt-4" disabled={pending} type="submit">
          {pending ? "Saving…" : "Add rule"}
        </Button>
      </form>

      <div className="min-w-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="font-bold">Saved rules</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Paused rules remain saved but do not categorize transactions.
            </p>
          </div>
          <span className="text-muted-foreground shrink-0 text-sm">
            {rules.length} {rules.length === 1 ? "rule" : "rules"}
          </span>
        </div>

        {state.message ? (
          <p
            className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900"
            role="alert"
          >
            {state.message}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
            role="status"
          >
            {state.success}
          </p>
        ) : null}

        {rules.length === 0 ? (
          <p className="bg-background text-muted-foreground mt-4 rounded-xl p-6 text-center text-sm">
            No categorization rules yet.
          </p>
        ) : (
          <ul className="mt-4 grid min-w-0 gap-3">
            {rules.map((rule) => (
              <li
                className="bg-background flex min-w-0 flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
                key={rule.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 font-semibold break-words">
                      {rule.pattern}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        rule.enabled
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {rule.enabled ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {matchTypeLabel(rule.matchType)} · {rule.categoryName}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    disabled={pending}
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("id", rule.id);
                      formData.set("enabled", String(!rule.enabled));
                      run(() => setCategoryRuleEnabledAction(formData));
                    }}
                    variant="secondary"
                  >
                    {rule.enabled ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(`Delete the rule for ${rule.pattern}?`)
                      ) {
                        return;
                      }
                      const formData = new FormData();
                      formData.set("id", rule.id);
                      run(() => deleteCategoryRuleAction(formData));
                    }}
                    variant="secondary"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function matchTypeLabel(matchType: CategoryRuleMatchType) {
  if (matchType === "exact") return "Exactly matches";
  if (matchType === "starts_with") return "Starts with";
  return "Contains";
}
