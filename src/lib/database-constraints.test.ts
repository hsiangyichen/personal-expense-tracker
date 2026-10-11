import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

function testCategory() {
  const suffix = randomUUID();
  const name = `Test ${suffix}`;

  return {
    id: suffix,
    name,
    normalizedName: name.toLowerCase(),
    color: "#475569",
  };
}

describe("database foundation", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("contains the eight default categories", async () => {
    await expect(prisma.category.count()).resolves.toBe(8);
  });

  it("rejects duplicate normalized category names", async () => {
    const category = testCategory();

    try {
      await prisma.category.create({ data: category });

      await expect(
        prisma.category.create({
          data: {
            ...testCategory(),
            name: `  ${category.name.toUpperCase()}  `,
            normalizedName: category.normalizedName,
          },
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.category.deleteMany({
        where: { normalizedName: category.normalizedName },
      });
    }
  });

  it("rejects a spending expense without a category", async () => {
    await expect(
      prisma.transaction.create({
        data: {
          transactionDate: "2026-01-15",
          sourceAmountMinor: 100,
          spendingAmountMinor: 100,
          currency: "CAD",
          merchant: "Test merchant",
          kind: "expense",
          reviewStatus: "included",
          source: "manual",
        },
      }),
    ).rejects.toThrow();
  });

  it("allows one budget per category and month", async () => {
    const category = testCategory();

    try {
      await prisma.category.create({ data: category });
      await prisma.budget.create({
        data: {
          categoryId: category.id,
          monthKey: "2026-01",
          amountMinor: 100,
        },
      });

      await expect(
        prisma.budget.create({
          data: {
            categoryId: category.id,
            monthKey: "2026-01",
            amountMinor: 200,
          },
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.budget.deleteMany({ where: { categoryId: category.id } });
      await prisma.category.deleteMany({ where: { id: category.id } });
    }
  });

  it("enforces category rule type and priority constraints", async () => {
    const category = testCategory();

    try {
      await prisma.category.create({ data: category });
      await expect(
        prisma.categoryRule.create({
          data: {
            matchType: "regex",
            pattern: "sample",
            normalizedPattern: "sample",
            categoryId: category.id,
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.categoryRule.create({
          data: {
            matchType: "exact",
            pattern: "sample",
            normalizedPattern: "sample",
            categoryId: category.id,
            priority: 1001,
          },
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.categoryRule.deleteMany({
        where: { categoryId: category.id },
      });
      await prisma.category.deleteMany({ where: { id: category.id } });
    }
  });
});
