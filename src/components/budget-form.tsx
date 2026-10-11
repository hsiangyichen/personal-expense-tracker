"use client";

import { useEffect, useState, useTransition } from "react";
import {
  saveBudgetAction,
  type BudgetActionState,
} from "@/app/categories/actions";
import { Button } from "@/components/ui/button";
import { CURRENCY } from "@/lib/constants";

export function BudgetForm({
  amountMinor,
  categoryId,
  categoryName,
  month,
}: Readonly<{
  amountMinor?: number;
  categoryId: string;
  categoryName: string;
  month: string;
}>) {
  const [state, setState] = useState<BudgetActionState>({});
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const inputId = `budget-${categoryId}`;

  useEffect(() => setHydrated(true), []);

  return (
    <form
      className="mt-3 min-w-0"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const response = await saveBudgetAction(formData);
          if (response.redirectTo) {
            window.location.assign(response.redirectTo);
            return;
          }
          setState(response);
        });
      }}
    >
      <input name="categoryId" type="hidden" value={categoryId} />
      <input name="monthKey" type="hidden" value={month} />
      <input name="currency" type="hidden" value={CURRENCY} />

      {state.message ? (
        <p className="mb-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.fieldErrors?.categoryId?.[0] ? (
        <p className="mb-2 text-sm text-red-700" role="alert">
          {state.fieldErrors.categoryId[0]}
        </p>
      ) : null}

      <label className="text-sm font-medium" htmlFor={inputId}>
        Monthly budget (CAD)
      </label>
      <div className="mt-1 flex w-full min-w-0 flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <input
            aria-describedby={
              state.fieldErrors?.amount?.[0] ? `${inputId}-error` : undefined
            }
            aria-invalid={Boolean(state.fieldErrors?.amount?.length)}
            aria-label={`Budget for ${categoryName}`}
            className="bg-card focus:border-primary min-h-11 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100"
            defaultValue={
              amountMinor === undefined ? "" : centsToInputValue(amountMinor)
            }
            id={inputId}
            inputMode="decimal"
            name="amount"
            placeholder="0.00"
            required
            type="text"
          />
          {state.fieldErrors?.amount?.[0] ? (
            <p className="mt-1 text-sm text-red-700" id={`${inputId}-error`}>
              {state.fieldErrors.amount[0]}
            </p>
          ) : null}
        </div>
        <Button disabled={pending || !hydrated} type="submit">
          {pending
            ? "Saving…"
            : amountMinor === undefined
              ? "Set budget"
              : "Update budget"}
        </Button>
      </div>
    </form>
  );
}

function centsToInputValue(amountMinor: number) {
  const minorUnits = BigInt(amountMinor);
  return `${minorUnits / 100n}.${(minorUnits % 100n)
    .toString()
    .padStart(2, "0")}`;
}
