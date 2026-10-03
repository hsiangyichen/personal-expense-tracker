import type { Prisma } from "@prisma/client";
import type { ExpenseInput } from "@/lib/expense-validation";
import { prisma } from "@/lib/prisma";

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Choose an available category.");
    this.name = "CategoryNotFoundError";
  }
}

export type ExpenseFilters = {
  monthKey: string;
  categoryId?: string;
  search?: string;
};

export function listExpenses({ monthKey, categoryId, search }: ExpenseFilters) {
  const where: Prisma.TransactionWhereInput = {
    kind: "expense",
    reviewStatus: "included",
    transactionDate: {
      gte: `${monthKey}-01`,
      lt: nextMonthStart(monthKey),
    },
  };

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (search) {
    where.OR = [
      { merchant: { contains: search } },
      { sourceDetails: { contains: search } },
    ];
  }

  return prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
  });
}

export function listTransactionsForMonth(monthKey: string) {
  return prisma.transaction.findMany({
    where: {
      transactionDate: {
        gte: `${monthKey}-01`,
        lt: nextMonthStart(monthKey),
      },
    },
    include: { category: true },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
  });
}

export function findExpenseById(id: string) {
  return prisma.transaction.findFirst({
    where: { id, kind: "expense", reviewStatus: "included" },
    include: { category: true },
  });
}

export async function createManualExpense(expense: ExpenseInput) {
  return prisma.$transaction(async (transaction) => {
    const category = await transaction.category.findUnique({
      where: { id: expense.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new CategoryNotFoundError();
    }

    return transaction.transaction.create({
      data: {
        transactionDate: expense.transactionDate,
        sourceAmountMinor: expense.amountMinor,
        spendingAmountMinor: expense.amountMinor,
        currency: expense.currency,
        merchant: expense.merchant,
        categoryId: expense.categoryId,
        note: expense.note,
        kind: "expense",
        reviewStatus: "included",
        source: "manual",
      },
    });
  });
}

export async function updateManualExpense(id: string, expense: ExpenseInput) {
  return prisma.$transaction(async (transaction) => {
    const [existingExpense, category] = await Promise.all([
      transaction.transaction.findFirst({
        where: { id, kind: "expense", source: "manual" },
        select: { id: true },
      }),
      transaction.category.findUnique({
        where: { id: expense.categoryId },
        select: { id: true },
      }),
    ]);

    if (!existingExpense) {
      return null;
    }

    if (!category) {
      throw new CategoryNotFoundError();
    }

    return transaction.transaction.update({
      where: { id },
      data: {
        transactionDate: expense.transactionDate,
        sourceAmountMinor: expense.amountMinor,
        spendingAmountMinor: expense.amountMinor,
        currency: expense.currency,
        merchant: expense.merchant,
        categoryId: expense.categoryId,
        note: expense.note,
      },
    });
  });
}

export async function deleteManualExpense(id: string): Promise<boolean> {
  const result = await prisma.transaction.deleteMany({
    where: { id, kind: "expense", source: "manual" },
  });

  return result.count === 1;
}

function nextMonthStart(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}
