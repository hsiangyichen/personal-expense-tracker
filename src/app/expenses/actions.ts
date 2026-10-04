"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CURRENCY } from "@/lib/constants";
import {
  isValidMonthKey,
  parseExpenseFormData,
} from "@/lib/expense-validation";
import {
  CategoryNotFoundError,
  createManualExpense,
  deleteManualExpense,
  updateManualExpense,
} from "@/lib/repositories/transactions";

export type ExpenseField =
  | "transactionDate"
  | "amount"
  | "currency"
  | "merchant"
  | "categoryId"
  | "note";

export type ExpenseActionState = {
  fieldErrors?: Partial<Record<ExpenseField, string[]>>;
  message?: string;
  redirectTo?: string;
};

export async function saveExpenseAction(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  formData.set("currency", CURRENCY);
  const result = parseExpenseFormData(formData);

  if (!result.success) {
    return {
      fieldErrors: result.error.flatten().fieldErrors,
      message: "Check the highlighted fields.",
    };
  }

  const { id, ...expense } = result.data;
  let mode: "created" | "updated" = "created";

  try {
    if (id) {
      const updated = await updateManualExpense(id, expense);
      if (!updated) {
        return { message: "This manual expense is no longer available." };
      }
      mode = "updated";
    } else {
      await createManualExpense(expense);
    }
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return {
        fieldErrors: { categoryId: [error.message] },
        message: "Check the highlighted fields.",
      };
    }

    return { message: "Could not save the expense. Try again." };
  }

  revalidatePath("/expenses");
  return {
    redirectTo: `/expenses?month=${expense.transactionDate.slice(0, 7)}&saved=${mode}`,
  };
}

export async function deleteExpenseAction(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const id = formData.get("id")?.toString().trim();
  const requestedMonth = formData.get("month")?.toString() ?? "";

  if (!id) {
    return { message: "This manual expense is no longer available." };
  }

  try {
    const deleted = await deleteManualExpense(id);
    if (!deleted) {
      return { message: "This manual expense is no longer available." };
    }
  } catch {
    return { message: "Could not delete the expense. Try again." };
  }

  const month = isValidMonthKey(requestedMonth)
    ? requestedMonth
    : new Date().toISOString().slice(0, 7);

  revalidatePath("/expenses");
  redirect(`/expenses?month=${month}&deleted=1`);
}
