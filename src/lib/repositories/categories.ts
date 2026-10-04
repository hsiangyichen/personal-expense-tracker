import { Prisma } from "@prisma/client";
import type { CategoryInput } from "@/lib/category-budget-validation";
import { prisma } from "@/lib/prisma";

export class DuplicateCategoryError extends Error {
  constructor() {
    super("A category with this name already exists.");
    this.name = "DuplicateCategoryError";
  }
}

export function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export function findCategoryByNormalizedName(normalizedName: string) {
  return prisma.category.findUnique({
    where: { normalizedName },
  });
}

export async function createCategory(category: CategoryInput) {
  try {
    return await prisma.category.create({ data: category });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateCategoryError();
    }
    throw error;
  }
}
