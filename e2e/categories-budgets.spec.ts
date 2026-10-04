import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { normalizeCategoryName } from "../src/lib/category-budget-validation";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("creates a category and manages its monthly budget", async ({
  page,
}, testInfo) => {
  const marker = `${testInfo.project.name.slice(0, 1)}-${randomUUID().slice(0, 8)}`;
  const categoryName = `PetCare-${marker}-${"x".repeat(30)}`;
  const normalizedName = normalizeCategoryName(categoryName);
  let categoryId: string | undefined;

  try {
    await page.goto("/categories?month=2026-11");
    await page.getByLabel("Category name").fill(categoryName);
    await page.getByLabel("Category color").fill("#2563eb");
    await page.getByRole("button", { name: "Create category" }).click();

    await expect(page.getByRole("status")).toContainText("Category created.");
    await expect(
      page.getByText(categoryName, { exact: true }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const category = await prisma.category.findUniqueOrThrow({
      where: { normalizedName },
    });
    categoryId = category.id;
    expect(category).toMatchObject({ name: categoryName, color: "#2563eb" });

    await page.getByLabel("Category name").fill(categoryName.toUpperCase());
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(
      page.getByText("A category with this name already exists."),
    ).toBeVisible();

    const budgetInput = page.getByLabel(`Budget for ${categoryName}`);
    const budgetForm = budgetInput.locator("xpath=ancestor::form");
    await budgetInput.fill("100.00");
    await budgetForm.getByRole("button", { name: "Set budget" }).click();
    await expect(page.getByRole("status")).toContainText("Budget created.");

    const updatedBudgetInput = page.getByLabel(`Budget for ${categoryName}`);
    const updatedBudgetForm = updatedBudgetInput.locator(
      "xpath=ancestor::form",
    );
    await expect(updatedBudgetInput).toHaveValue("100.00");
    await updatedBudgetInput.fill("75.50");
    await updatedBudgetForm
      .getByRole("button", { name: "Update budget" })
      .click();
    await expect(page.getByRole("status")).toContainText("Budget updated.");

    await expect(
      prisma.budget.count({ where: { categoryId, monthKey: "2026-11" } }),
    ).resolves.toBe(1);
    await expect(
      prisma.budget.findUniqueOrThrow({
        where: {
          categoryId_monthKey: { categoryId, monthKey: "2026-11" },
        },
      }),
    ).resolves.toMatchObject({ amountMinor: 7_550 });

    await prisma.transaction.createMany({
      data: [
        {
          id: randomUUID(),
          transactionDate: "2026-11-10",
          sourceAmountMinor: 8_000,
          spendingAmountMinor: 8_000,
          merchant: `Synthetic expense ${marker}`,
          categoryId,
          kind: "expense",
          reviewStatus: "included",
          source: "manual",
        },
        {
          id: randomUUID(),
          transactionDate: "2026-11-12",
          sourceAmountMinor: 1_000,
          spendingAmountMinor: -1_000,
          merchant: `Synthetic refund ${marker}`,
          categoryId,
          kind: "refund",
          reviewStatus: "included",
          source: "manual",
        },
      ],
    });

    await page.goto("/?month=2026-11");
    const progress = page.getByRole("progressbar", {
      name: `${categoryName} budget`,
    });
    await expect(progress).toHaveAttribute(
      "aria-valuetext",
      "$70.00 CAD used of $75.50 CAD",
    );
    const progressItem = progress.locator("..");
    await expect(progressItem.getByText("Used $70.00 CAD")).toBeVisible();
    await expect(progressItem.getByText("Limit $75.50 CAD")).toBeVisible();
    await expect(progressItem.getByText("Remaining $5.50 CAD")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/categories?month=2026-11");
    const exceededInput = page.getByLabel(`Budget for ${categoryName}`);
    await exceededInput.fill("60.00");
    await exceededInput
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Update budget" })
      .click();
    await expect(page.getByRole("status")).toContainText("Budget updated.");

    await page.goto("/?month=2026-11");
    const exceededProgress = page.getByRole("progressbar", {
      name: `${categoryName} budget`,
    });
    await expect(exceededProgress).toHaveAttribute("aria-valuenow", "100");
    await expect(
      exceededProgress.locator("..").getByText("Over by $10.00 CAD"),
    ).toBeVisible();
  } finally {
    if (!categoryId) {
      categoryId = (
        await prisma.category.findUnique({ where: { normalizedName } })
      )?.id;
    }
    if (categoryId) {
      await prisma.transaction.deleteMany({ where: { categoryId } });
      await prisma.budget.deleteMany({ where: { categoryId } });
      await prisma.category.delete({ where: { id: categoryId } });
    }
  }
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}
