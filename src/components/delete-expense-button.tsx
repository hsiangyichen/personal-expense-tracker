"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteExpenseAction,
  type ExpenseActionState,
} from "@/app/expenses/actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: ExpenseActionState = {};

type DeleteExpenseButtonProps = {
  expenseId: string;
  merchant: string;
  month: string;
};

export function DeleteExpenseButton({
  expenseId,
  merchant,
  month,
}: DeleteExpenseButtonProps) {
  const [state, formAction] = useActionState(
    deleteExpenseAction,
    INITIAL_STATE,
  );

  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(event) => {
        if (!window.confirm(`Delete the expense from ${merchant}?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={expenseId} />
      <input name="month" type="hidden" value={month} />
      <DeleteButton merchant={merchant} />
      {state.message ? (
        <span className="ml-2 text-sm text-red-700" role="alert">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function DeleteButton({ merchant }: Readonly<{ merchant: string }>) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={`Delete ${merchant}`}
      className="min-h-9 px-3 py-1"
      disabled={pending}
      type="submit"
      variant="secondary"
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
