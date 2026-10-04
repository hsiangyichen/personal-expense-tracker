import { prisma } from "@/lib/prisma";

export function listBudgetsForMonth(monthKey: string) {
  return prisma.budget.findMany({
    where: { monthKey },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });
}
