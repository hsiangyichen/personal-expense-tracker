import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("matches dashboard totals to the selected month's expense list", async ({
  page,
}, testInfo) => {
  const marker = `${testInfo.project.name}-${randomUUID()}`;
  const groceries = await prisma.category.findUniqueOrThrow({
    where: { normalizedName: "groceries" },
  });
  const dining = await prisma.category.findUniqueOrThrow({
    where: { normalizedName: "dining" },
  });
  const transactionIds = [randomUUID(), randomUUID(), randomUUID()];

  try {
    await prisma.transaction.createMany({
      data: [
        {
          id: transactionIds[0],
          transactionDate: "2026-06-14",
          sourceAmountMinor: 1_234,
          spendingAmountMinor: 1_234,
          merchant: `Example market ${marker}`,
          categoryId: groceries.id,
          kind: "expense",
          reviewStatus: "included",
          source: "manual",
        },
        {
          id: transactionIds[1],
          transactionDate: "2026-06-20",
          sourceAmountMinor: 566,
          spendingAmountMinor: 566,
          merchant: `Example cafe ${marker}`,
          categoryId: dining.id,
          kind: "expense",
          reviewStatus: "included",
          source: "manual",
        },
        {
          id: transactionIds[2],
          transactionDate: "2026-07-01",
          sourceAmountMinor: 700,
          spendingAmountMinor: 700,
          merchant: `Next month ${marker}`,
          categoryId: groceries.id,
          kind: "expense",
          reviewStatus: "included",
          source: "manual",
        },
      ],
    });

    await page.goto("/?month=2026-06");

    await expect(
      page.getByText("Spending summary for June 2026."),
    ).toBeVisible();
    const monthlyCard = page
      .getByRole("heading", { name: "Monthly spending" })
      .locator("..");
    await expect(monthlyCard.getByText("$18.00 CAD")).toBeVisible();

    const largestCard = page
      .getByRole("heading", { name: "Largest category" })
      .locator("..");
    await expect(
      largestCard.getByText("Groceries", { exact: true }),
    ).toBeVisible();
    await expect(largestCard.getByText("$12.34 CAD")).toBeVisible();

    const categoryBreakdown = page
      .getByRole("heading", { name: "Category breakdown" })
      .locator("..");
    await expect(categoryBreakdown.getByText("Groceries")).toBeVisible();
    await expect(categoryBreakdown.getByText("Dining")).toBeVisible();
    await expect(categoryBreakdown.getByText("$12.34 CAD")).toBeVisible();
    await expect(categoryBreakdown.getByText("$5.66 CAD")).toBeVisible();

    await page.goto(`/expenses?month=2026-06&search=${marker}`);
    await expect(page.getByText("2 expenses")).toBeVisible();
    await expect(page.getByText("$12.34 CAD")).toBeVisible();
    await expect(page.getByText("$5.66 CAD")).toBeVisible();

    await page.goto("/?month=2026-06");
    await page.getByLabel("Month", { exact: true }).fill("2026-07");
    await page.getByRole("button", { name: "View month" }).click();
    await expect(
      page.getByText("Spending summary for July 2026."),
    ).toBeVisible();
    await expect(
      page
        .getByRole("heading", { name: "Monthly spending" })
        .locator("..")
        .getByText("$7.00 CAD"),
    ).toBeVisible();
  } finally {
    await prisma.transaction.deleteMany({
      where: { id: { in: transactionIds } },
    });
  }
});
