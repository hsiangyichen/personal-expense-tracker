import {
  InvalidCategoryRuleError,
  prepareCategoryRuleInput,
  type CategoryRuleInput,
  type PreparedCategoryRuleInput,
} from "@/lib/category-rule-validation";
import type { TransactionKind } from "@/lib/constants";
import { isValidDateOnly } from "@/lib/expense-validation";
import { prisma } from "@/lib/prisma";

export class RepeatedImportError extends Error {
  constructor() {
    super("This file was already imported. Choose Import again to continue.");
    this.name = "RepeatedImportError";
  }
}

export class InvalidImportDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImportDataError";
  }
}

export type ImportTransactionInput = {
  transactionDate: string;
  postDate: string;
  sourceAmountMinor: number;
  spendingAmountMinor: number;
  merchant: string;
  sourceDetails: string;
  sourceType: string;
  kind: TransactionKind;
  reviewStatus: "included" | "excluded";
  categoryId: string | null;
};

export type SaveImportInput = {
  fileName: string;
  fileFingerprint: string;
  rowCount: number;
  importAgain: boolean;
  transactions: ImportTransactionInput[];
  categoryRules?: CategoryRuleInput[];
};

export function listRecentImports(limit = 10) {
  return prisma.importBatch.findMany({
    orderBy: { importedAt: "desc" },
    take: limit,
  });
}
export function findImportsByFingerprint(fileFingerprint: string) {
  return prisma.importBatch.findMany({
    where: { fileFingerprint },
    orderBy: { importedAt: "desc" },
  });
}

export function saveImportAtomically(input: SaveImportInput) {
  const categoryRules = validateImportInput(input);

  return prisma.$transaction(async (transaction) => {
    if (!input.importAgain) {
      const existing = await transaction.importBatch.findFirst({
        where: { fileFingerprint: input.fileFingerprint },
        select: { id: true },
      });
      if (existing) {
        throw new RepeatedImportError();
      }
    }

    const expenseCount = input.transactions.filter(
      (row) => row.kind === "expense" && row.reviewStatus === "included",
    ).length;
    const excludedPaymentCount = input.transactions.filter(
      (row) => row.kind === "payment",
    ).length;
    const refundCount = input.transactions.filter(
      (row) => row.kind === "refund",
    ).length;

    const saved = await transaction.importBatch.create({
      data: {
        fileName: input.fileName,
        fileFingerprint: input.fileFingerprint,
        rowCount: input.rowCount,
        expenseCount,
        excludedPaymentCount,
        refundCount,
        transactions: {
          create: input.transactions.map((row) => ({
            ...row,
            currency: "CAD",
            source: "csv",
          })),
        },
      },
      include: { transactions: true },
    });

    for (const rule of categoryRules) {
      await transaction.categoryRule.upsert({
        where: {
          matchType_normalizedPattern: {
            matchType: rule.matchType,
            normalizedPattern: rule.normalizedPattern,
          },
        },
        update: {
          pattern: rule.pattern,
          categoryId: rule.categoryId,
          priority: rule.priority,
          enabled: true,
          source: "user",
        },
        create: {
          ...rule,
          enabled: true,
          source: "user",
        },
      });
    }

    return { ...saved, learnedRuleCount: categoryRules.length };
  });
}

function validateImportInput(input: SaveImportInput) {
  if (!input.fileName.trim() || input.fileName.length > 255) {
    throw new InvalidImportDataError("Import file name is invalid.");
  }
  if (!/^[a-f0-9]{64}$/.test(input.fileFingerprint)) {
    throw new InvalidImportDataError("Import fingerprint is invalid.");
  }
  if (
    !Number.isInteger(input.rowCount) ||
    input.rowCount < 1 ||
    input.transactions.length > input.rowCount
  ) {
    throw new InvalidImportDataError("Import row count is invalid.");
  }

  for (const row of input.transactions) {
    validateTransaction(row);
  }

  return prepareImportedCategoryRules(input.categoryRules ?? []);
}

function prepareImportedCategoryRules(categoryRules: CategoryRuleInput[]) {
  const byPattern = new Map<string, PreparedCategoryRuleInput>();

  for (const categoryRule of categoryRules) {
    let prepared: PreparedCategoryRuleInput;
    try {
      prepared = prepareCategoryRuleInput(categoryRule);
    } catch (error) {
      if (error instanceof InvalidCategoryRuleError) {
        throw new InvalidImportDataError("Imported category rule is invalid.");
      }
      throw error;
    }

    const key = `${prepared.matchType}:${prepared.normalizedPattern}`;
    const existing = byPattern.get(key);
    if (existing && existing.categoryId !== prepared.categoryId) {
      throw new InvalidImportDataError(
        "The same merchant cannot be remembered with different categories.",
      );
    }
    if (!existing) {
      byPattern.set(key, prepared);
    }
  }

  return [...byPattern.values()];
}

function validateTransaction(row: ImportTransactionInput) {
  if (
    !isValidDateOnly(row.transactionDate) ||
    !isValidDateOnly(row.postDate) ||
    !row.merchant.trim() ||
    row.merchant.length > 120 ||
    !row.sourceDetails ||
    !row.sourceType ||
    !Number.isInteger(row.sourceAmountMinor) ||
    !Number.isInteger(row.spendingAmountMinor) ||
    Math.abs(row.sourceAmountMinor) > 2_147_483_647 ||
    Math.abs(row.spendingAmountMinor) > 2_147_483_647 ||
    !["expense", "payment", "refund"].includes(row.kind)
  ) {
    throw new InvalidImportDataError("Import transaction is invalid.");
  }

  if (
    row.kind === "expense" &&
    (row.sourceAmountMinor <= 0 ||
      row.spendingAmountMinor !== row.sourceAmountMinor ||
      row.reviewStatus !== "included" ||
      !row.categoryId)
  ) {
    throw new InvalidImportDataError("Imported expense is invalid.");
  }

  if (
    row.kind === "payment" &&
    (row.sourceAmountMinor >= 0 ||
      row.spendingAmountMinor !== 0 ||
      row.reviewStatus !== "excluded" ||
      row.categoryId !== null)
  ) {
    throw new InvalidImportDataError("Imported payment is invalid.");
  }

  if (row.kind === "refund") {
    const countedRefundIsValid =
      row.reviewStatus === "included" &&
      row.sourceAmountMinor !== 0 &&
      row.spendingAmountMinor === -Math.abs(row.sourceAmountMinor) &&
      Boolean(row.categoryId);
    const excludedRefundIsValid =
      row.reviewStatus === "excluded" &&
      row.sourceAmountMinor !== 0 &&
      row.spendingAmountMinor === 0 &&
      row.categoryId === null;

    if (!countedRefundIsValid && !excludedRefundIsValid) {
      throw new InvalidImportDataError("Imported refund is invalid.");
    }
  }
}
