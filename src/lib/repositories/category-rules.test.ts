import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { categorizeMerchantWithRules } from "@/lib/categorization-engine";
import { prisma } from "@/lib/prisma";
import { createCategory } from "@/lib/repositories/categories";
import {
  CategoryRuleCategoryNotFoundError,
  CategoryRuleNotFoundError,
  createCategoryRule,
  deleteCategoryRule,
  DuplicateCategoryRuleError,
  listCategoryRules,
  setCategoryRuleEnabled,
  updateCategoryRule,
} from "@/lib/repositories/category-rules";

const categoryIds: string[] = [];

async function testCategory(label: string) {
  const suffix = randomUUID();
  const category = await createCategory({
    name: `${label} ${suffix}`,
    normalizedName: `${label.toLowerCase()} ${suffix}`,
    color: "#2563eb",
  });
  categoryIds.push(category.id);
  return category;
}

afterEach(async () => {
  await prisma.categoryRule.deleteMany({
    where: { categoryId: { in: categoryIds } },
  });
  await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  categoryIds.length = 0;
});

describe("category rule repository", () => {
  it("normalizes, stores, and lists an enabled rule", async () => {
    const category = await testCategory("Rule category");
    const created = await createCategoryRule({
      matchType: "starts_with",
      pattern: "  SAMPLE #123  ",
      categoryId: category.id,
      priority: 25,
    });

    expect(created).toMatchObject({
      matchType: "starts_with",
      pattern: "SAMPLE #123",
      normalizedPattern: "sample 123",
      categoryId: category.id,
      priority: 25,
      enabled: true,
      source: "user",
    });
    const rules = await listCategoryRules({ enabledOnly: true });
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, categoryId: category.id }),
      ]),
    );
    expect(
      categorizeMerchantWithRules("Sample #123 Downtown", rules),
    ).toMatchObject({
      status: "matched",
      categoryId: category.id,
      ruleId: created.id,
    });
  });

  it("rejects duplicate normalized patterns for one match type", async () => {
    const firstCategory = await testCategory("First category");
    const secondCategory = await testCategory("Second category");
    await createCategoryRule({
      matchType: "exact",
      pattern: "Sample-Market",
      categoryId: firstCategory.id,
    });

    await expect(
      createCategoryRule({
        matchType: "exact",
        pattern: " sample market ",
        categoryId: secondCategory.id,
      }),
    ).rejects.toBeInstanceOf(DuplicateCategoryRuleError);

    await expect(
      createCategoryRule({
        matchType: "contains",
        pattern: "sample market",
        categoryId: secondCategory.id,
      }),
    ).resolves.toMatchObject({ matchType: "contains" });
  });

  it("rejects missing categories and missing rules", async () => {
    await expect(
      createCategoryRule({
        matchType: "exact",
        pattern: "Sample",
        categoryId: "missing-category",
      }),
    ).rejects.toBeInstanceOf(CategoryRuleCategoryNotFoundError);

    await expect(
      setCategoryRuleEnabled("missing-rule", false),
    ).rejects.toBeInstanceOf(CategoryRuleNotFoundError);
    await expect(deleteCategoryRule("missing-rule")).rejects.toBeInstanceOf(
      CategoryRuleNotFoundError,
    );
  });

  it("updates and disables an existing rule", async () => {
    const firstCategory = await testCategory("First category");
    const secondCategory = await testCategory("Second category");
    const created = await createCategoryRule({
      matchType: "contains",
      pattern: "Original",
      categoryId: firstCategory.id,
    });

    const updated = await updateCategoryRule(created.id, {
      matchType: "starts_with",
      pattern: "Updated Store",
      categoryId: secondCategory.id,
      priority: 50,
    });
    expect(updated).toMatchObject({
      id: created.id,
      matchType: "starts_with",
      normalizedPattern: "updated store",
      categoryId: secondCategory.id,
      priority: 50,
      enabled: true,
    });

    await setCategoryRuleEnabled(created.id, false);
    await expect(
      prisma.categoryRule.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({ enabled: false });
    await expect(listCategoryRules({ enabledOnly: true })).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    );
  });
});
