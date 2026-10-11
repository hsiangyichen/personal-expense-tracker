import { createHash, randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CategoryRuleInput } from "@/lib/category-rule-validation";
import { normalizeMerchant } from "@/lib/merchant-normalization";
import { prisma } from "@/lib/prisma";
import {
  InvalidImportDataError,
  RepeatedImportError,
  saveImportAtomically,
  type ImportTransactionInput,
} from "@/lib/repositories/imports";

const fingerprints: string[] = [];
const rulePatterns: string[] = [];

function fingerprint() {
  return createHash("sha256").update(randomUUID()).digest("hex");
}
let categoryId: string;
let secondCategoryId: string;

beforeAll(async () => {
  categoryId = (
    await prisma.category.findUniqueOrThrow({
      where: { normalizedName: "groceries" },
    })
  ).id;
  secondCategoryId = (
    await prisma.category.findUniqueOrThrow({
      where: { normalizedName: "dining" },
    })
  ).id;
});

afterEach(async () => {
  const imports = await prisma.importBatch.findMany({
    where: { fileFingerprint: { in: fingerprints } },
    select: { id: true },
  });
  const importIds = imports.map(({ id }) => id);
  await prisma.transaction.deleteMany({
    where: { importId: { in: importIds } },
  });
  await prisma.importBatch.deleteMany({ where: { id: { in: importIds } } });
  await prisma.categoryRule.deleteMany({
    where: { normalizedPattern: { in: rulePatterns } },
  });
  fingerprints.length = 0;
  rulePatterns.length = 0;
});

function purchase(overrides: Partial<ImportTransactionInput> = {}) {
  return {
    transactionDate: "2026-01-01",
    postDate: "2026-01-02",
    sourceAmountMinor: 1_000,
    spendingAmountMinor: 1_000,
    merchant: "Synthetic Purchase",
    sourceDetails: "Synthetic Purchase",
    sourceType: "Purchase",
    kind: "expense" as const,
    reviewStatus: "included" as const,
    categoryId,
    ...overrides,
  };
}

function input(
  fileFingerprint: string,
  transactions: ImportTransactionInput[],
  importAgain = false,
  categoryRules: CategoryRuleInput[] = [],
) {
  fingerprints.push(fileFingerprint);
  for (const rule of categoryRules) {
    rulePatterns.push(normalizeMerchant(rule.pattern));
  }
  return {
    fileName: "synthetic-statement.csv",
    fileFingerprint,
    rowCount: transactions.length,
    importAgain,
    transactions,
    categoryRules,
  };
}

describe("CSV import repository", () => {
  it("saves the import and all confirmed rows atomically", async () => {
    const fileFingerprint = fingerprint();
    const saved = await saveImportAtomically(
      input(fileFingerprint, [
        purchase(),
        purchase({
          kind: "payment",
          sourceAmountMinor: -2_000,
          spendingAmountMinor: 0,
          categoryId: null,
          sourceType: "Payment",
          reviewStatus: "excluded",
        }),
        purchase({
          kind: "refund",
          sourceAmountMinor: 500,
          spendingAmountMinor: -500,
          sourceType: "Refund settled",
        }),
      ]),
    );

    expect(saved).toMatchObject({
      fileFingerprint,
      rowCount: 3,
      expenseCount: 1,
      excludedPaymentCount: 1,
      refundCount: 1,
    });
    expect(saved.transactions).toHaveLength(3);
  });

  it("creates or updates remembered rules in the import transaction", async () => {
    const fileFingerprint = fingerprint();
    const pattern = `Remembered Merchant ${randomUUID()}`;
    const normalizedPattern = normalizeMerchant(pattern);
    await prisma.categoryRule.create({
      data: {
        matchType: "exact",
        pattern,
        normalizedPattern,
        categoryId: secondCategoryId,
      },
    });

    const saved = await saveImportAtomically(
      input(fileFingerprint, [purchase({ merchant: pattern })], false, [
        { matchType: "exact", pattern, categoryId },
      ]),
    );

    expect(saved.learnedRuleCount).toBe(1);
    await expect(
      prisma.categoryRule.findUniqueOrThrow({
        where: {
          matchType_normalizedPattern: {
            matchType: "exact",
            normalizedPattern,
          },
        },
      }),
    ).resolves.toMatchObject({ categoryId, enabled: true, source: "user" });
  });

  it("blocks a repeated file until Import again is explicit", async () => {
    const fileFingerprint = fingerprint();
    await saveImportAtomically(input(fileFingerprint, [purchase()]));

    await expect(
      saveImportAtomically(input(fileFingerprint, [purchase()])),
    ).rejects.toBeInstanceOf(RepeatedImportError);
    await expect(
      saveImportAtomically(input(fileFingerprint, [purchase()], true)),
    ).resolves.toMatchObject({ fileFingerprint });
  });

  it("rolls back the import when any transaction fails", async () => {
    const fileFingerprint = fingerprint();

    await expect(
      saveImportAtomically(
        input(fileFingerprint, [
          purchase(),
          purchase({ categoryId: "missing-category" }),
        ]),
      ),
    ).rejects.toThrow();

    await expect(
      prisma.importBatch.count({ where: { fileFingerprint } }),
    ).resolves.toBe(0);
    await expect(
      prisma.transaction.count({
        where: { sourceDetails: "Synthetic Purchase" },
      }),
    ).resolves.toBe(0);
  });
  it("rolls back the import when a remembered rule cannot be saved", async () => {
    const fileFingerprint = fingerprint();
    const pattern = `Missing Category Rule ${randomUUID()}`;

    await expect(
      saveImportAtomically(
        input(fileFingerprint, [purchase()], false, [
          { matchType: "exact", pattern, categoryId: "missing-category" },
        ]),
      ),
    ).rejects.toThrow();

    await expect(
      prisma.importBatch.count({ where: { fileFingerprint } }),
    ).resolves.toBe(0);
    await expect(
      prisma.categoryRule.count({
        where: { normalizedPattern: normalizeMerchant(pattern) },
      }),
    ).resolves.toBe(0);
  });
});

describe("CSV import invariants", () => {
  it("rejects an included payment before opening a partial import", async () => {
    const fileFingerprint = fingerprint();

    expect(() =>
      saveImportAtomically(
        input(fileFingerprint, [
          purchase({
            kind: "payment",
            sourceAmountMinor: -1_000,
            spendingAmountMinor: 0,
            categoryId: null,
            sourceType: "Payment",
            reviewStatus: "included",
          }),
        ]),
      ),
    ).toThrow(InvalidImportDataError);

    await expect(
      prisma.importBatch.count({ where: { fileFingerprint } }),
    ).resolves.toBe(0);
  });

  it("rejects unknown kinds and out-of-range amounts", () => {
    const unknownKind = input(fingerprint(), [
      purchase({ kind: "adjustment" as ImportTransactionInput["kind"] }),
    ]);
    const oversizedAmount = input(fingerprint(), [
      purchase({
        sourceAmountMinor: 2_147_483_648,
        spendingAmountMinor: 2_147_483_648,
      }),
    ]);

    expect(() => saveImportAtomically(unknownKind)).toThrow(
      InvalidImportDataError,
    );
    expect(() => saveImportAtomically(oversizedAmount)).toThrow(
      InvalidImportDataError,
    );
  });
});
