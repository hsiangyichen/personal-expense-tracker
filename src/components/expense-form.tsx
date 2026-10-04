"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  saveExpenseAction,
  type ExpenseActionState,
  type ExpenseField,
} from "@/app/expenses/actions";
import { Button } from "@/components/ui/button";
import { CURRENCY } from "@/lib/constants";

const INITIAL_STATE: ExpenseActionState = {};
const fieldClassName =
  "bg-card mt-1 min-h-11 w-full rounded-md border px-3 py-2 text-sm";

type CategoryOption = {
  id: string;
  name: string;
};

type EditableExpense = {
  id: string;
  transactionDate: string;
  sourceAmountMinor: number;
  merchant: string;
  categoryId: string | null;
  note: string | null;
};

type ExpenseFormProps = {
  categories: CategoryOption[];
  expense?: EditableExpense;
  cancelHref: string;
};

export function ExpenseForm({
  categories,
  expense,
  cancelHref,
}: ExpenseFormProps) {
  const [state, setState] = useState<ExpenseActionState>(INITIAL_STATE);
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const isEditing = Boolean(expense);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <form
      className="mt-5 space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const nextState = await saveExpenseAction(state, formData);
          if (nextState.redirectTo) {
            window.location.assign(nextState.redirectTo);
            return;
          }
          setState(nextState);
        });
      }}
    >
      {expense ? <input name="id" type="hidden" value={expense.id} /> : null}
      <input name="currency" type="hidden" value={CURRENCY} />

      {state.message ? (
        <p
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" name="transactionDate" state={state}>
          <input
            aria-describedby={errorId("transactionDate", state)}
            aria-invalid={hasError("transactionDate", state)}
            className={fieldClassName}
            defaultValue={expense?.transactionDate}
            id="transactionDate"
            name="transactionDate"
            required
            type="date"
          />
        </Field>

        <Field label="Amount (CAD)" name="amount" state={state}>
          <input
            aria-describedby={errorId("amount", state)}
            aria-invalid={hasError("amount", state)}
            className={fieldClassName}
            defaultValue={
              expense ? centsToInputValue(expense.sourceAmountMinor) : undefined
            }
            id="amount"
            inputMode="decimal"
            name="amount"
            placeholder="0.00"
            required
            type="text"
          />
        </Field>
      </div>

      <Field label="Merchant" name="merchant" state={state}>
        <input
          aria-describedby={errorId("merchant", state)}
          aria-invalid={hasError("merchant", state)}
          className={fieldClassName}
          defaultValue={expense?.merchant}
          id="merchant"
          maxLength={120}
          name="merchant"
          required
          type="text"
        />
      </Field>

      <Field label="Category" name="categoryId" state={state}>
        <select
          aria-describedby={errorId("categoryId", state)}
          aria-invalid={hasError("categoryId", state)}
          className={fieldClassName}
          defaultValue={expense?.categoryId ?? ""}
          id="categoryId"
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
      </Field>

      <Field label="Note (optional)" name="note" state={state}>
        <textarea
          aria-describedby={errorId("note", state)}
          aria-invalid={hasError("note", state)}
          className={`${fieldClassName} min-h-24`}
          defaultValue={expense?.note ?? ""}
          id="note"
          maxLength={500}
          name="note"
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          isEditing={isEditing}
          pending={pending}
          ready={hydrated}
        />
        {isEditing ? (
          <Link
            className="bg-card hover:bg-muted inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
            href={cancelHref}
          >
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  children,
  label,
  name,
  state,
}: Readonly<{
  children: ReactNode;
  label: string;
  name: ExpenseField;
  state: ExpenseActionState;
}>) {
  const error = state.fieldErrors?.[name]?.[0];

  return (
    <div>
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-red-700" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({
  isEditing,
  pending,
  ready,
}: Readonly<{ isEditing: boolean; pending: boolean; ready: boolean }>) {
  return (
    <Button disabled={pending || !ready} type="submit">
      {pending ? "Saving…" : isEditing ? "Save changes" : "Add expense"}
    </Button>
  );
}

function hasError(field: ExpenseField, state: ExpenseActionState) {
  return Boolean(state.fieldErrors?.[field]?.length);
}

function errorId(field: ExpenseField, state: ExpenseActionState) {
  return hasError(field, state) ? `${field}-error` : undefined;
}

function centsToInputValue(amountMinor: number) {
  const minorUnits = BigInt(amountMinor);
  const dollars = minorUnits / 100n;
  const cents = minorUnits % 100n;
  return `${dollars}.${cents.toString().padStart(2, "0")}`;
}
