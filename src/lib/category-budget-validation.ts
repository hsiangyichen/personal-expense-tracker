import { z } from "zod";
import { CURRENCY } from "@/lib/constants";
import { isValidMonthKey } from "@/lib/expense-validation";
import {
  MoneyValidationError,
  parsePositiveCadAmountToCents,
} from "@/lib/money";

const categoryNameSchema = z
  .string()
  .transform(collapseWhitespace)
  .pipe(
    z
      .string()
      .min(1, "Enter a category name.")
      .max(50, "Category name must be 50 characters or fewer."),
  );

export const categoryFormSchema = z
  .object({
    name: categoryNameSchema,
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid category color."),
  })
  .transform(({ name, color }) => ({
    name,
    normalizedName: normalizeCategoryName(name),
    color: color.toLowerCase(),
  }));

const budgetAmountSchema = z.string().transform((value, context) => {
  try {
    return parsePositiveCadAmountToCents(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message:
        error instanceof MoneyValidationError
          ? error.message
          : "Enter a valid amount.",
    });
    return z.NEVER;
  }
});

export const budgetFormSchema = z.object({
  categoryId: z.string().trim().min(1, "Choose a category."),
  monthKey: z.string().refine(isValidMonthKey, "Choose a valid month."),
  amount: budgetAmountSchema,
  currency: z.literal(CURRENCY, {
    error: "Budgets must use CAD.",
  }),
});

export type CategoryInput = z.output<typeof categoryFormSchema>;
export type BudgetInput = {
  categoryId: string;
  monthKey: string;
  amountMinor: number;
};

export function normalizeCategoryName(value: string) {
  return collapseWhitespace(value).toLocaleLowerCase("en-CA");
}

export function parseCategoryFormData(formData: FormData) {
  return categoryFormSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    color: formData.get("color")?.toString() ?? "",
  });
}

export function parseBudgetFormData(formData: FormData) {
  const result = budgetFormSchema.safeParse({
    categoryId: formData.get("categoryId")?.toString() ?? "",
    monthKey: formData.get("monthKey")?.toString() ?? "",
    amount: formData.get("amount")?.toString() ?? "",
    currency: formData.get("currency")?.toString() ?? "",
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true as const,
    data: {
      categoryId: result.data.categoryId,
      monthKey: result.data.monthKey,
      amountMinor: result.data.amount,
    } satisfies BudgetInput,
  };
}

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
