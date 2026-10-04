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
  validateImportInput(input);

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

    return transaction.importBatch.create({
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
