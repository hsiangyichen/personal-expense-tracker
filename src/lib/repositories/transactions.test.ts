import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createManualExpense,
  deleteManualExpense,
  findExpenseById,
  listExpenses,
  updateManualExpense,
} from "@/lib/repositories/transactions";

describe("manual expense repository", () => {
  const createdIds: string[] = [];
  const importIds: string[] = [];

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.importBatch.deleteMany({ where: { id: { in: importIds } } });
    await prisma.$disconnect();
  });

  it("creates, filters, updates, reloads, and deletes a manual expense", async () => {
    const [groceries, dining] = await Promise.all([
      prisma.category.findUniqueOrThrow({
        where: { normalizedName: "groceries" },
      }),
      prisma.category.findUniqueOrThrow({
        where: { normalizedName: "dining" },
      }),
    ]);
    const marker = `Manual ${randomUUID()}`;
    const expense = await createManualExpense({
      transactionDate: "2026-08-14",
      amountMinor: 2_147_483_647,
      currency: "CAD",
      merchant: marker,
      categoryId: groceries.id,
      note: "Initial note",
    });
    createdIds.push(expense.id);

    await expect(
      listExpenses({ monthKey: "2026-08", search: marker }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: expense.id,
        sourceAmountMinor: 2_147_483_647,
        spendingAmountMinor: 2_147_483_647,
        source: "manual",
      }),
    ]);
    await expect(
      listExpenses({ monthKey: "2026-09", search: marker }),
    ).resolves.toHaveLength(0);
    await expect(
      listExpenses({
        monthKey: "2026-08",
        categoryId: dining.id,
        search: marker,
      }),
    ).resolves.toHaveLength(0);

    const updated = await updateManualExpense(expense.id, {
      transactionDate: "2026-08-15",
      amountMinor: 5678,
      currency: "CAD",
      merchant: `${marker} updated`,
      categoryId: dining.id,
      note: null,
    });

    expect(updated).toEqual(
      expect.objectContaining({
        sourceAmountMinor: 5678,
        spendingAmountMinor: 5678,
        merchant: `${marker} updated`,
        categoryId: dining.id,
      }),
    );
    await expect(findExpenseById(expense.id)).resolves.toEqual(
      expect.objectContaining({ merchant: `${marker} updated` }),
    );
    await expect(deleteManualExpense(expense.id)).resolves.toBe(true);
    await expect(findExpenseById(expense.id)).resolves.toBeNull();
  });

  it("searches the preserved CSV source details", async () => {
    const category = await prisma.category.findUniqueOrThrow({
      where: { normalizedName: "other" },
    });
    const marker = `Source details ${randomUUID()}`;
    const importId = randomUUID();
    const transactionId = randomUUID();
    importIds.push(importId);
    createdIds.push(transactionId);

    await prisma.importBatch.create({
      data: {
        id: importId,
        fileName: "synthetic.csv",
        fileFingerprint: randomUUID(),
        rowCount: 1,
        expenseCount: 1,
        excludedPaymentCount: 0,
        refundCount: 0,
        transactions: {
          create: {
            id: transactionId,
            transactionDate: "2026-07-02",
            postDate: "2026-07-03",
            sourceAmountMinor: 2500,
            spendingAmountMinor: 2500,
            merchant: "Corrected merchant",
            sourceDetails: marker,
            categoryId: category.id,
            kind: "expense",
            reviewStatus: "included",
            source: "csv",
            sourceType: "Purchase",
          },
        },
      },
    });

    await expect(
      listExpenses({ monthKey: "2026-07", search: marker }),
    ).resolves.toEqual([
      expect.objectContaining({ id: transactionId, sourceDetails: marker }),
    ]);
  });
});
