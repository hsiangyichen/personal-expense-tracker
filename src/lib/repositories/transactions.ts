import { prisma } from "@/lib/prisma";

export function listTransactionsForMonth(monthKey: string) {
  return prisma.transaction.findMany({
    where: {
      transactionDate: {
        gte: `${monthKey}-01`,
        lt: nextMonthStart(monthKey),
      },
    },
    include: { category: true },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
  });
}

function nextMonthStart(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}
