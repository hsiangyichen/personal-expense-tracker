"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  createCategoryAction,
  type CategoryActionState,
  type CategoryField,
} from "@/app/categories/actions";
import { Button } from "@/components/ui/button";

const fieldClassName =
  "bg-card mt-1 min-h-11 w-full rounded-xl border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-blue-100";

export function CategoryForm({ month }: Readonly<{ month: string }>) {
  const [state, setState] = useState<CategoryActionState>({});
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return (
    <form
      className="mt-4 space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const response = await createCategoryAction(formData);
          if (response.redirectTo) {
            window.location.assign(response.redirectTo);
            return;
          }
          setState(response);
        });
      }}
    >
      <input name="selectedMonth" type="hidden" value={month} />
      {state.message ? (
        <p
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <Field label="Category name" name="name" state={state}>
        <input
          aria-describedby={errorId("name", state)}
          aria-invalid={hasError("name", state)}
          className={fieldClassName}
          id="name"
          maxLength={50}
          name="name"
          required
          type="text"
        />
      </Field>

      <Field label="Category color" name="color" state={state}>
        <input
          aria-describedby={errorId("color", state)}
          aria-invalid={hasError("color", state)}
          className="bg-card mt-1 h-11 w-full cursor-pointer rounded-xl border p-1"
          defaultValue="#37a89d"
          id="color"
          name="color"
          required
          type="color"
        />
      </Field>

      <Button disabled={pending || !hydrated} type="submit">
        {pending ? "Creating…" : "Create category"}
      </Button>
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
  name: CategoryField;
  state: CategoryActionState;
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

function hasError(field: CategoryField, state: CategoryActionState) {
  return Boolean(state.fieldErrors?.[field]?.length);
}

function errorId(field: CategoryField, state: CategoryActionState) {
  return hasError(field, state) ? `${field}-error` : undefined;
}
