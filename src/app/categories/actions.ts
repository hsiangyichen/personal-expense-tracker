"use server";

import { revalidatePath } from "next/cache";
import {
  parseBudgetFormData,
  parseCategoryFormData,
} from "@/lib/category-budget-validation";
import { CURRENCY } from "@/lib/constants";
import { currentMonthKey, isValidMonthKey } from "@/lib/expense-validation";
import {
  BudgetCategoryNotFoundError,
  saveMonthlyBudget,
} from "@/lib/repositories/budgets";
import {
  DuplicateCategoryError,
  createCategory,
} from "@/lib/repositories/categories";

export type CategoryField = "name" | "color";
export type BudgetField = "categoryId" | "monthKey" | "amount" | "currency";

export type CategoryActionState = {
  fieldErrors?: Partial<Record<CategoryField, string[]>>;
  message?: string;
  redirectTo?: string;
};

export type BudgetActionState = {
  fieldErrors?: Partial<Record<BudgetField, string[]>>;
  message?: string;
  redirectTo?: string;
};

export async function createCategoryAction(
  formData: FormData,
): Promise<CategoryActionState> {
  const result = parseCategoryFormData(formData);
  if (!result.success) {
    return {
      fieldErrors: result.error.flatten().fieldErrors,
      message: "Check the highlighted fields.",
    };
  }

  try {
    await createCategory(result.data);
  } catch (error) {
    if (error instanceof DuplicateCategoryError) {
      return {
        fieldErrors: { name: [error.message] },
        message: "Check the highlighted fields.",
      };
    }
    return { message: "Could not create the category. Try again." };
  }

  revalidatePath("/");
  revalidatePath("/categories");
  revalidatePath("/expenses");
  revalidatePath("/import");

  return {
    redirectTo: `/categories?month=${requestedMonth(formData)}&saved=category`,
  };
}

export async function saveBudgetAction(
  formData: FormData,
): Promise<BudgetActionState> {
  formData.set("currency", CURRENCY);
  const result = parseBudgetFormData(formData);
  if (!result.success) {
    return {
      fieldErrors: result.error.flatten().fieldErrors,
      message: "Check the highlighted fields.",
    };
  }

  try {
    const saved = await saveMonthlyBudget(result.data);
    revalidatePath("/");
    revalidatePath("/categories");
    return {
      redirectTo: `/categories?month=${result.data.monthKey}&saved=${
        saved.created ? "budget-created" : "budget-updated"
      }`,
    };
  } catch (error) {
    if (error instanceof BudgetCategoryNotFoundError) {
      return {
        fieldErrors: { categoryId: [error.message] },
        message: "Check the highlighted fields.",
      };
    }
    return { message: "Could not save the budget. Try again." };
  }
}

function requestedMonth(formData: FormData) {
  const month = formData.get("selectedMonth")?.toString() ?? "";
  return isValidMonthKey(month) ? month : currentMonthKey();
}
