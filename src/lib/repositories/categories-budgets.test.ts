import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeCategoryName,
  type CategoryInput,
} from "@/lib/category-budget-validation";
import { prisma } from "@/lib/prisma";
import {
  BudgetCategoryNotFoundError,
  saveMonthlyBudget,
} from "@/lib/repositories/budgets";
import {
  DuplicateCategoryError,
  createCategory,
} from "@/lib/repositories/categories";

const categoryIds: string[] = [];

function category(name: string): CategoryInput {
  return {
    name: name.trim().replace(/\s+/g, " "),
    normalizedName: normalizeCategoryName(name),
    color: "#123456",
  };
}

afterEach(async () => {
  await prisma.budget.deleteMany({
    where: { categoryId: { in: categoryIds } },
  });
  await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  categoryIds.length = 0;
});

describe("category repository", () => {
  it("rejects category names that match after spacing and capitalization", async () => {
    const marker = randomUUID();
    const created = await createCategory(category(`Pet Care ${marker}`));
    categoryIds.push(created.id);

    await expect(
      createCategory(category(`  PET   CARE ${marker.toUpperCase()}  `)),
    ).rejects.toBeInstanceOf(DuplicateCategoryError);
  });
});

describe("budget repository", () => {
  it("updates the existing category and month budget", async () => {
    const createdCategory = await createCategory(
      category(`Budget category ${randomUUID()}`),
    );
    categoryIds.push(createdCategory.id);

    const first = await saveMonthlyBudget({
      categoryId: createdCategory.id,
      monthKey: "2098-01",
      amountMinor: 10_000,
    });
    const second = await saveMonthlyBudget({
      categoryId: createdCategory.id,
      monthKey: "2098-01",
      amountMinor: 25_000,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.budget.id).toBe(first.budget.id);
    expect(second.budget.amountMinor).toBe(25_000);
    await expect(
      prisma.budget.count({
        where: { categoryId: createdCategory.id, monthKey: "2098-01" },
      }),
    ).resolves.toBe(1);
  });

  it("rejects a budget for a missing category", async () => {
    await expect(
      saveMonthlyBudget({
        categoryId: "missing-category",
        monthKey: "2098-02",
        amountMinor: 1_000,
      }),
    ).rejects.toBeInstanceOf(BudgetCategoryNotFoundError);
  });
});
