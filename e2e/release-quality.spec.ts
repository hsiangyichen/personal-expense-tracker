import { expect, test, type Page } from "@playwright/test";

const corePages = [
  { path: "/?month=2099-12", heading: "Dashboard" },
  { path: "/expenses?month=2099-12", heading: "Expenses" },
  { path: "/import", heading: "Import CSV" },
  { path: "/categories?month=2099-12", heading: "Categories & budgets" },
  { path: "/data", heading: "Data & backup" },
] as const;

test("shows the required empty states", async ({ page }) => {
  await page.goto("/?month=2099-12");
  await expect(
    page.getByText("Add an expense to see category totals."),
  ).toBeVisible();
  await expect(
    page.getByText("No spending activity for this month."),
  ).toBeVisible();
  await expect(
    page.getByText("Set a monthly budget to track progress."),
  ).toBeVisible();

  await page.goto("/expenses?month=2099-12&search=no-matching-expense");
  await expect(page.getByText("No expenses found")).toBeVisible();

  await page.goto("/data");
  await expect(page.getByText("No imports yet")).toBeVisible();
});

test("keeps every core screen accessible and within the viewport", async ({
  page,
}) => {
  for (const entry of corePages) {
    await page.goto(entry.path);
    await expect(
      page.getByRole("heading", { name: entry.heading, level: 1 }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectInteractiveControlsToHaveNames(page);

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).not.toHaveJSProperty(
      "tagName",
      "BODY",
    );
  }
});

async function expectInteractiveControlsToHaveNames(page: Page) {
  const controls = page.locator(
    'a, button, input:not([type="hidden"]), select, textarea',
  );
  for (let index = 0; index < (await controls.count()); index += 1) {
    await expect(controls.nth(index)).toHaveAccessibleName(/\S/);
  }
}

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
