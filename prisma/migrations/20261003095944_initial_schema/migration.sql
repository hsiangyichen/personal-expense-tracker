-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_normalized_name_check" CHECK (
        "normalizedName" = lower(trim("name")) AND length(trim("name")) > 0
    )
);

-- CreateTable
CREATE TABLE "imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileFingerprint" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "expenseCount" INTEGER NOT NULL,
    "excludedPaymentCount" INTEGER NOT NULL,
    "refundCount" INTEGER NOT NULL,
    CONSTRAINT "imports_currency_check" CHECK ("currency" = 'CAD'),
    CONSTRAINT "imports_counts_check" CHECK (
        "rowCount" >= 0 AND "expenseCount" >= 0 AND
        "excludedPaymentCount" >= 0 AND "refundCount" >= 0
    )
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionDate" TEXT NOT NULL,
    "postDate" TEXT,
    "sourceAmountMinor" INTEGER NOT NULL,
    "spendingAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "merchant" TEXT NOT NULL,
    "sourceDetails" TEXT,
    "categoryId" TEXT,
    "note" TEXT,
    "kind" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT,
    "importId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_currency_check" CHECK ("currency" = 'CAD'),
    CONSTRAINT "transactions_kind_check" CHECK ("kind" IN ('expense', 'payment', 'refund')),
    CONSTRAINT "transactions_review_status_check" CHECK (
        "reviewStatus" IN ('included', 'excluded', 'needs_review', 'duplicate_warning')
    ),
    CONSTRAINT "transactions_source_check" CHECK ("source" IN ('manual', 'csv')),
    CONSTRAINT "transactions_merchant_check" CHECK (length(trim("merchant")) > 0),
    CONSTRAINT "transactions_spending_effect_check" CHECK (
        ("kind" = 'expense' AND "spendingAmountMinor" > 0 AND "categoryId" IS NOT NULL) OR
        ("kind" = 'payment' AND "spendingAmountMinor" = 0 AND "categoryId" IS NULL) OR
        ("kind" = 'refund' AND "spendingAmountMinor" <= 0 AND
            ("spendingAmountMinor" = 0 OR "categoryId" IS NOT NULL))
    ),
    CONSTRAINT "transactions_source_relationship_check" CHECK (
        ("source" = 'manual' AND "importId" IS NULL AND "sourceType" IS NULL AND
            "sourceDetails" IS NULL AND "postDate" IS NULL AND "sourceAmountMinor" > 0) OR
        ("source" = 'csv' AND "importId" IS NOT NULL AND "sourceType" IS NOT NULL AND
            "sourceDetails" IS NOT NULL AND "postDate" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "budgets_amount_check" CHECK ("amountMinor" > 0),
    CONSTRAINT "budgets_month_key_check" CHECK (
        length("monthKey") = 7 AND substr("monthKey", 5, 1) = '-' AND
        CAST(substr("monthKey", 6, 2) AS INTEGER) BETWEEN 1 AND 12
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_normalizedName_key" ON "categories"("normalizedName");

-- CreateIndex
CREATE INDEX "imports_fileFingerprint_idx" ON "imports"("fileFingerprint");

-- CreateIndex
CREATE INDEX "transactions_transactionDate_idx" ON "transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "transactions_categoryId_transactionDate_idx" ON "transactions"("categoryId", "transactionDate");

-- CreateIndex
CREATE INDEX "transactions_importId_idx" ON "transactions"("importId");

-- CreateIndex
CREATE INDEX "budgets_monthKey_idx" ON "budgets"("monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_categoryId_monthKey_key" ON "budgets"("categoryId", "monthKey");
