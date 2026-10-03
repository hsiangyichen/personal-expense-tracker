import { prisma } from "@/lib/prisma";

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
