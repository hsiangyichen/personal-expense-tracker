import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultCategories = [
  { name: "Groceries", normalizedName: "groceries", color: "#15803d" },
  { name: "Dining", normalizedName: "dining", color: "#c2410c" },
  {
    name: "Transportation",
    normalizedName: "transportation",
    color: "#0369a1",
  },
  { name: "Housing", normalizedName: "housing", color: "#7e22ce" },
  { name: "Shopping", normalizedName: "shopping", color: "#be185d" },
  {
    name: "Entertainment",
    normalizedName: "entertainment",
    color: "#4338ca",
  },
  { name: "Health", normalizedName: "health", color: "#0f766e" },
  { name: "Other", normalizedName: "other", color: "#475569" },
] as const;

async function main() {
  for (const category of defaultCategories) {
    await prisma.category.upsert({
      where: { normalizedName: category.normalizedName },
      update: {},
      create: category,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
