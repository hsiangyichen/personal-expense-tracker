import { PrismaClient } from "@prisma/client";
import { registerApplicationProcess } from "@/lib/application-lock";
import { resolveStoragePaths } from "@/lib/storage-paths";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

if (process.env.NODE_ENV !== "test") {
  registerApplicationProcess(resolveStoragePaths().runtimeMarkerDirectory);
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
