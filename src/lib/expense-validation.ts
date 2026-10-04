import { z } from "zod";
import { CURRENCY } from "@/lib/constants";
import {
  MoneyValidationError,
  parsePositiveCadAmountToCents,
} from "@/lib/money";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

export function isValidMonthKey(value: string): boolean {
  const match = MONTH_KEY_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

const amountSchema = z.string().transform((value, context) => {
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

export const expenseFormSchema = z
  .object({
    id: z.string().trim().optional(),
    transactionDate: z.string().refine(isValidDateOnly, "Enter a valid date."),
    amount: amountSchema,
    currency: z.literal(CURRENCY, {
      error: "Manual expenses must use CAD.",
    }),
    merchant: z
      .string()
      .trim()
      .min(1, "Enter a merchant.")
      .max(120, "Merchant must be 120 characters or fewer."),
    categoryId: z.string().trim().min(1, "Choose a category."),
    note: z.string().trim().max(500, "Note must be 500 characters or fewer."),
  })
  .transform(({ amount, note, ...expense }) => ({
    ...expense,
    amountMinor: amount,
    note: note || null,
  }));

export type ExpenseInput = Omit<z.output<typeof expenseFormSchema>, "id">;

export function parseExpenseFormData(formData: FormData) {
  return expenseFormSchema.safeParse({
    id: formData.get("id")?.toString(),
    transactionDate: formData.get("transactionDate")?.toString() ?? "",
    amount: formData.get("amount")?.toString() ?? "",
    currency: formData.get("currency")?.toString() ?? "",
    merchant: formData.get("merchant")?.toString() ?? "",
    categoryId: formData.get("categoryId")?.toString() ?? "",
    note: formData.get("note")?.toString() ?? "",
  });
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
