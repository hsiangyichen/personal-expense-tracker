-- CreateTable
CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchType" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "normalizedPattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "category_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "category_rules_match_type_check" CHECK ("matchType" IN ('exact', 'starts_with', 'contains')),
    CONSTRAINT "category_rules_pattern_check" CHECK (length(trim("pattern")) BETWEEN 1 AND 120),
    CONSTRAINT "category_rules_normalized_pattern_check" CHECK (length(trim("normalizedPattern")) BETWEEN 1 AND 120),
    CONSTRAINT "category_rules_priority_check" CHECK ("priority" BETWEEN 0 AND 1000),
    CONSTRAINT "category_rules_enabled_check" CHECK ("enabled" IN (0, 1)),
    CONSTRAINT "category_rules_source_check" CHECK ("source" IN ('user', 'seed'))
);

-- CreateIndex
CREATE UNIQUE INDEX "category_rules_matchType_normalizedPattern_key" ON "category_rules"("matchType", "normalizedPattern");

-- CreateIndex
CREATE INDEX "category_rules_categoryId_enabled_idx" ON "category_rules"("categoryId", "enabled");
