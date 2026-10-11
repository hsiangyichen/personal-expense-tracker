import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const headers = "transaction_date,post_date,type,details,amount,currency";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("reviews decisions and imports a synthetic statement", async ({
  page,
}, testInfo) => {
  const marker = `${testInfo.project.name}-${randomUUID()}`;
  const duplicateDetails = `Synthetic duplicate ${marker}`;
  const refundDetails = `Synthetic refund ${marker}`;
  const correctedMerchant = `Corrected merchant ${marker}`;
  const csv = [
    headers,
    `2026-09-01,2026-09-02,Purchase,${duplicateDetails},10.00,CAD`,
    `2026-09-01,2026-09-02,Purchase,${duplicateDetails},10.00,CAD`,
    `2026-09-03,2026-09-04,Payment,Synthetic payment ${marker},-30.00,CAD`,
    `2026-09-05,2026-09-06,Refund initiated,${refundDetails},5.00,CAD`,
    `2026-09-08,2026-09-09,Refund settled,${refundDetails},-5.00,CAD`,
    `2026-09-10,2026-09-11,Purchase,Synthetic invalid ${marker},-8.00,CAD`,
  ].join("\n");
  const fingerprint = createHash("sha256").update(csv).digest("hex");

  try {
    await page.goto("/import");
    await page.getByLabel("CSV file").setInputFiles({
      name: `synthetic-${marker}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Review file" }).click();

    const summary = page.getByRole("region", { name: "Import summary" });
    await expect(summary.getByText("Included purchases")).toBeVisible();
    await expect(
      summary
        .getByText("Included purchases")
        .locator("..")
        .getByText("2", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await expect(summary.getByText("Excluded payments")).toBeVisible();
    await expect(summary.getByText("Refund candidates")).toBeVisible();

    const replacementCsv = [
      headers,
      `2026-09-12,2026-09-13,Purchase,Synthetic replacement ${marker},3.00,CAD`,
    ].join("\n");
    await page.getByLabel("CSV file").setInputFiles({
      name: `replacement-${marker}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(replacementCsv),
    });
    await expect(
      page.getByRole("heading", { name: "Review rows" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Review the newly selected file before importing."),
    ).toBeVisible();

    await page.getByLabel("CSV file").setInputFiles({
      name: `synthetic-${marker}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Review file" }).click();
    await expect(summary.getByText("Included purchases")).toBeVisible();
    await expect(summary.getByText("Invalid rows")).toBeVisible();
    await expect(summary.getByText("Duplicate warnings")).toBeVisible();

    const importButton = page.getByRole("button", {
      name: "Import reviewed rows",
    });
    await expect(importButton).toBeDisabled();

    await visibleControl(page, "Merchant for row 2").fill(correctedMerchant);
    await visibleControl(page, "Category for row 2").selectOption({
      label: "Groceries",
    });
    await visibleControl(page, "Possible duplicate")
      .nth(0)
      .selectOption("include");

    await visibleControl(page, "Category for row 3").selectOption({
      label: "Dining",
    });
    await visibleControl(page, "Possible duplicate")
      .nth(1)
      .selectOption("exclude");

    await visibleControl(page, "Refund", true).nth(0).selectOption("count");
    await visibleControl(page, "Category for row 5").selectOption({
      label: "Groceries",
    });
    await visibleControl(page, "Refund", true).nth(1).selectOption("count");
    await visibleControl(page, "Category for row 6").selectOption({
      label: "Groceries",
    });

    await expect(
      page.getByText("Similar refunds are both counted."),
    ).toBeVisible();

    await visibleControl(page, "Refund", true).nth(1).selectOption("exclude");
    await expect(
      page.getByText("Similar refunds are both counted."),
    ).toHaveCount(0);

    await visibleControl(page, "Exclude invalid row 7").check();
    await expect(
      page.getByText("All required decisions are complete."),
    ).toBeVisible();
    await expect(importButton).toBeEnabled();
    await importButton.click();

    await expect(
      page.getByRole("heading", { name: "Statement saved" }),
    ).toBeVisible();
    await expect(resultCard(page, "Saved rows")).toContainText("4");
    await expect(resultCard(page, "Excluded payments")).toContainText("1");
    await expect(resultCard(page, "Refund rows")).toContainText("2");
    await expect(resultCard(page, "Duplicate warnings")).toContainText("1");
    await expect(resultCard(page, "Invalid rows excluded")).toContainText("1");
    await expect(
      page.getByText(
        "1 refunds counted, 1 excluded from spending, and 1 duplicate-warning rows excluded.",
      ),
    ).toBeVisible();

    const savedRows = await prisma.transaction.findMany({
      where: { import: { fileFingerprint: fingerprint } },
      orderBy: { transactionDate: "asc" },
    });
    expect(savedRows).toHaveLength(4);
    expect(savedRows[0]).toMatchObject({
      merchant: correctedMerchant,
      sourceDetails: duplicateDetails,
      spendingAmountMinor: 1_000,
    });
    expect(savedRows.filter((row) => row.kind === "payment")[0]).toMatchObject({
      spendingAmountMinor: 0,
      reviewStatus: "excluded",
      categoryId: null,
    });
    expect(savedRows.filter((row) => row.kind === "refund")).toEqual([
      expect.objectContaining({
        spendingAmountMinor: -500,
        reviewStatus: "included",
      }),
      expect.objectContaining({
        spendingAmountMinor: 0,
        reviewStatus: "excluded",
        categoryId: null,
      }),
    ]);
  } finally {
    await removeImports(fingerprint);
  }
});

test("blocks a repeated file until Import again is selected", async ({
  page,
}, testInfo) => {
  const marker = `${testInfo.project.name}-${randomUUID()}`;
  const csv = [
    headers,
    `2026-10-01,2026-10-02,Purchase,Synthetic repeated ${marker},7.00,CAD`,
  ].join("\n");
  const fingerprint = createHash("sha256").update(csv).digest("hex");

  await prisma.importBatch.create({
    data: {
      fileName: "earlier-synthetic.csv",
      fileFingerprint: fingerprint,
      rowCount: 1,
      expenseCount: 0,
      excludedPaymentCount: 0,
      refundCount: 0,
    },
  });

  try {
    await page.goto("/import");
    await page.getByLabel("CSV file").setInputFiles({
      name: `repeated-${marker}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Review file" }).click();

    await expect(
      page.getByText("This file was already imported."),
    ).toBeVisible();
    await visibleControl(page, "Category for row 2").selectOption({
      label: "Groceries",
    });

    const importButton = page.getByRole("button", {
      name: "Import reviewed rows",
    });
    await expect(importButton).toBeDisabled();
    await page.getByLabel("Import again").check();
    await expect(importButton).toBeEnabled();
    await importButton.click();

    await expect(
      page.getByRole("heading", { name: "Statement saved" }),
    ).toBeVisible();
    await expect(
      prisma.importBatch.count({ where: { fileFingerprint: fingerprint } }),
    ).resolves.toBe(2);
  } finally {
    await removeImports(fingerprint);
  }
});

function visibleControl(page: Page, label: string, exact = false) {
  return page.getByLabel(label, { exact }).filter({ visible: true });
}

function resultCard(page: Page, label: string) {
  return page.locator("div.rounded-xl").filter({ hasText: label });
}

async function removeImports(fileFingerprint: string) {
  const imports = await prisma.importBatch.findMany({
    where: { fileFingerprint },
    select: { id: true },
  });
  const importIds = imports.map(({ id }) => id);
  await prisma.transaction.deleteMany({
    where: { importId: { in: importIds } },
  });
  await prisma.importBatch.deleteMany({ where: { id: { in: importIds } } });
}
