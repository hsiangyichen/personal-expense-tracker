import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("manages a manual expense from creation through deletion", async ({
  page,
}, testInfo) => {
  const marker = `${testInfo.project.name}-${randomUUID()}`;
  const originalMerchant = `Example market ${marker}`;
  const updatedMerchant = `Updated market ${marker}`;

  try {
    await page.goto("/expenses?month=2026-08");

    await page.getByLabel("Date", { exact: true }).fill("2026-08-14");
    await page.getByLabel("Amount (CAD)").fill("0");
    await page.getByLabel("Merchant", { exact: true }).fill(originalMerchant);
    await page.locator("#categoryId").selectOption({ label: "Groceries" });
    await page.getByRole("button", { name: "Add expense" }).click();
    await expect(
      page.getByText("Amount must be greater than zero."),
    ).toBeVisible();

    await page.getByLabel("Amount (CAD)").fill("12.34");
    await page.getByLabel("Note (optional)").fill("Synthetic browser test");
    await page.getByRole("button", { name: "Add expense" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Expense added." }),
    ).toBeVisible();
    const createdRow = page
      .getByRole("row")
      .filter({ hasText: originalMerchant });
    await expect(createdRow).toBeVisible();
    await expect(
      createdRow.getByText("$12.34 CAD", { exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByText(originalMerchant, { exact: true }),
    ).toBeVisible();

    await page.getByLabel("Merchant or details").fill(marker);
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(
      page.getByText(originalMerchant, { exact: true }),
    ).toBeVisible();

    await page.locator("#category").selectOption({ label: "Dining" });
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByText(originalMerchant, { exact: true })).toHaveCount(
      0,
    );

    await page.locator("#category").selectOption({ label: "Groceries" });
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.getByRole("link", { name: `Edit ${originalMerchant}` }).click();

    await expect(
      page.getByRole("heading", { name: "Edit expense" }),
    ).toBeVisible();
    await page.getByLabel("Merchant", { exact: true }).fill(updatedMerchant);
    await page.getByLabel("Amount (CAD)").fill("56.78");
    await page.locator("#categoryId").selectOption({ label: "Dining" });
    await expect(page.getByLabel("Merchant", { exact: true })).toHaveValue(
      updatedMerchant,
    );
    await expect(page.getByLabel("Amount (CAD)")).toHaveValue("56.78");
    await expect(page.locator("#categoryId option:checked")).toHaveText(
      "Dining",
    );
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Expense updated." }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: updatedMerchant }),
    ).toBeVisible();

    await page.locator("#category").selectOption({ label: "Dining" });
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: updatedMerchant }),
    ).toBeVisible();

    await page.getByLabel("Merchant or details").fill(marker);
    await page.getByRole("button", { name: "Apply filters" }).click();
    const updatedRow = page
      .getByRole("row")
      .filter({ hasText: updatedMerchant });
    await expect(updatedRow).toBeVisible();
    await expect(
      updatedRow.getByText("$56.78 CAD", { exact: true }),
    ).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: `Delete ${updatedMerchant}` })
      .click();

    await expect(
      page.getByRole("status").filter({ hasText: "Expense deleted." }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: updatedMerchant }),
    ).toHaveCount(0);
  } finally {
    await prisma.transaction.deleteMany({
      where: { merchant: { contains: marker } },
    });
  }
});
