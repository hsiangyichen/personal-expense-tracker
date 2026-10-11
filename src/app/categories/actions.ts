"use server";

import { revalidatePath } from "next/cache";
import {
  parseBudgetFormData,
  parseCategoryFormData,
} from "@/lib/category-budget-validation";
import {
  InvalidCategoryRuleError,
  parseCategoryRuleMatchType,
} from "@/lib/category-rule-validation";
import { CURRENCY } from "@/lib/constants";
import { currentMonthKey, isValidMonthKey } from "@/lib/expense-validation";
import {
  BudgetCategoryNotFoundError,
  saveMonthlyBudget,
} from "@/lib/repositories/budgets";
import {
  CategoryRuleCategoryNotFoundError,
  CategoryRuleNotFoundError,
  createCategoryRule,
  deleteCategoryRule,
  DuplicateCategoryRuleError,
  setCategoryRuleEnabled,
} from "@/lib/repositories/category-rules";
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

export type CategoryRuleActionState = {
  message?: string;
  success?: string;
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

export async function createCategoryRuleAction(
  formData: FormData,
): Promise<CategoryRuleActionState> {
  try {
    await createCategoryRule({
      matchType: parseCategoryRuleMatchType(
        formData.get("matchType")?.toString() ?? "",
      ),
      pattern: formData.get("pattern")?.toString() ?? "",
      categoryId: formData.get("categoryId")?.toString() ?? "",
    });
  } catch (error) {
    return { message: categoryRuleErrorMessage(error) };
  }

  revalidateCategoryRules();
  return { success: "Categorization rule created." };
}

export async function setCategoryRuleEnabledAction(
  formData: FormData,
): Promise<CategoryRuleActionState> {
  try {
    await setCategoryRuleEnabled(
      formData.get("id")?.toString() ?? "",
      formData.get("enabled") === "true",
    );
  } catch (error) {
    return { message: categoryRuleErrorMessage(error) };
  }

  revalidateCategoryRules();
  return {
    success:
      formData.get("enabled") === "true"
        ? "Categorization rule resumed."
        : "Categorization rule paused.",
  };
}

export async function deleteCategoryRuleAction(
  formData: FormData,
): Promise<CategoryRuleActionState> {
  try {
    await deleteCategoryRule(formData.get("id")?.toString() ?? "");
  } catch (error) {
    return { message: categoryRuleErrorMessage(error) };
  }

  revalidateCategoryRules();
  return { success: "Categorization rule deleted." };
}

function categoryRuleErrorMessage(error: unknown) {
  if (
    error instanceof InvalidCategoryRuleError ||
    error instanceof DuplicateCategoryRuleError ||
    error instanceof CategoryRuleCategoryNotFoundError ||
    error instanceof CategoryRuleNotFoundError
  ) {
    return error.message;
  }
  return "Could not save the categorization rule. Try again.";
}

function revalidateCategoryRules() {
  revalidatePath("/categories");
  revalidatePath("/import");
}

function requestedMonth(formData: FormData) {
  const month = formData.get("selectedMonth")?.toString() ?? "";
  return isValidMonthKey(month) ? month : currentMonthKey();
}
