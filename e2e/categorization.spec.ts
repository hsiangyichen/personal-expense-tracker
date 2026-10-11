import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { normalizeMerchant } from "../src/lib/merchant-normalization";

const prisma = new PrismaClient();
const headers = "transaction_date,post_date,type,details,amount,currency";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("creates a rule, preselects a category, and remembers a correction", async ({
  page,
}, testInfo) => {
  const marker = `${testInfo.project.name}-${randomUUID()}`;
  const automaticMerchant = `Automatic Grocery ${marker}`;
  const learnedMerchant = `Learned Cafe ${marker}`;
  const csv = [
    headers,
    `2026-10-20,2026-10-21,Purchase,${automaticMerchant},12.34,CAD`,
    `2026-10-22,2026-10-23,Purchase,${learnedMerchant},5.67,CAD`,
  ].join("\n");
  const fingerprint = createHash("sha256").update(csv).digest("hex");
  const groceries = await prisma.category.findUniqueOrThrow({
    where: { normalizedName: "groceries" },
  });
  const dining = await prisma.category.findUniqueOrThrow({
    where: { normalizedName: "dining" },
  });

  try {
    await page.goto("/categories?month=2026-10#categorization-rules");
    await page.getByLabel("Merchant pattern").fill(automaticMerchant);
    await page.getByLabel("Match when merchant").selectOption("exact");
    await page.getByLabel("Category", { exact: true }).selectOption({
      label: "Groceries",
    });
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Categorization rule created.",
    );
    await expect(
      page.getByText(automaticMerchant, { exact: true }),
    ).toBeVisible();

    await page.goto("/import");
    await page.getByLabel("CSV file").setInputFiles({
      name: `categorization-${marker}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Review file" }).click();

    const summary = page.getByRole("region", { name: "Import summary" });
    await expect(
      summaryMetric(summary, "Automatically selected"),
    ).toContainText("1");
    await expect(summaryMetric(summary, "Needs category")).toContainText("1");

    await expect(visibleControl(page, "Category for row 2")).toHaveValue(
      groceries.id,
    );
    await expect(visibleText(page, "Automatic · 100%")).toBeVisible();
    await expect(visibleText(page, /Matched exact rule/)).toBeVisible();

    const automaticCategory = visibleControl(page, "Category for row 2");
    await visibleControl(page, "Merchant for row 2").fill(
      `${automaticMerchant} Updated`,
    );
    await expect(automaticCategory).toHaveValue("");
    await expect(summaryMetric(summary, "Needs category")).toContainText("2");

    await visibleControl(page, "Merchant for row 2").fill(automaticMerchant);
    await automaticCategory.selectOption(groceries.id);
    await expect(summaryMetric(summary, "Needs category")).toContainText("1");

    await visibleControl(page, "Category for row 3").selectOption(dining.id);
    await expect(visibleText(page, "Selected manually")).toBeVisible();
    await expect(
      summaryMetric(summary, "Needs category").getByText("0", {
        exact: true,
      }),
    ).toBeVisible();
    const rememberRule = visibleControl(
      page,
      `Always categorize ${learnedMerchant} as Dining`,
    );
    await expect(rememberRule).toBeVisible();
    await rememberRule.check();

    const importButton = page.getByRole("button", {
      name: "Import reviewed rows",
    });
    await expect(importButton).toBeEnabled();
    await importButton.click();

    await expect(
      page.getByRole("heading", { name: "Statement saved" }),
    ).toBeVisible();
    await expect(resultCard(page, "Rules learned")).toContainText("1");

    const savedImport = await prisma.importBatch.findFirstOrThrow({
      where: { fileFingerprint: fingerprint },
      include: { transactions: true },
    });
    expect(savedImport.transactions).toHaveLength(2);
    await expect(
      prisma.categoryRule.findUniqueOrThrow({
        where: {
          matchType_normalizedPattern: {
            matchType: "exact",
            normalizedPattern: normalizeMerchant(learnedMerchant),
          },
        },
      }),
    ).resolves.toMatchObject({ categoryId: dining.id, enabled: true });
  } finally {
    const imports = await prisma.importBatch.findMany({
      where: { fileFingerprint: fingerprint },
      select: { id: true },
    });
    const importIds = imports.map(({ id }) => id);
    await prisma.transaction.deleteMany({
      where: { importId: { in: importIds } },
    });
    await prisma.importBatch.deleteMany({ where: { id: { in: importIds } } });
    await prisma.categoryRule.deleteMany({
      where: {
        normalizedPattern: {
          in: [
            normalizeMerchant(automaticMerchant),
            normalizeMerchant(learnedMerchant),
          ],
        },
      },
    });
  }
});

function visibleText(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true });
}

function visibleControl(page: Page, label: string, exact = false) {
  return page.getByLabel(label, { exact }).filter({ visible: true });
}

function summaryMetric(summary: ReturnType<Page["getByRole"]>, label: string) {
  return summary.getByText(label, { exact: true }).locator("..");
}

function resultCard(page: Page, label: string) {
  return page.locator("div.rounded-xl").filter({ hasText: label });
}
