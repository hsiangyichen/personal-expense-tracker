import { expect, test } from "@playwright/test";

test("navigates through the application shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Expenses", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Expenses" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Import CSV" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Import CSV" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Categories & budgets" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Categories & budgets" }),
  ).toBeVisible();
});
