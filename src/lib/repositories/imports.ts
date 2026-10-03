import { prisma } from "@/lib/prisma";

export function findImportsByFingerprint(fileFingerprint: string) {
  return prisma.importBatch.findMany({
    where: { fileFingerprint },
    orderBy: { importedAt: "desc" },
  });
}
