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
  { name: "Clothing", normalizedName: "clothing", color: "#db2777" },
  {
    name: "Subscriptions",
    normalizedName: "subscriptions",
    color: "#7c3aed",
  },
  { name: "Internet", normalizedName: "internet", color: "#0284c7" },
  { name: "Phone", normalizedName: "phone", color: "#2563eb" },
  { name: "Travel", normalizedName: "travel", color: "#0891b2" },
  {
    name: "Personal Care",
    normalizedName: "personal care",
    color: "#e11d48",
  },
  { name: "Household", normalizedName: "household", color: "#65a30d" },
  { name: "Education", normalizedName: "education", color: "#ca8a04" },
  {
    name: "Car Insurance",
    normalizedName: "car insurance",
    color: "#4f46e5",
  },
  {
    name: "Medical Aesthetics",
    normalizedName: "medical aesthetics",
    color: "#be123c",
  },
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
