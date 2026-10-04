import { chmod, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { inspectDatabaseFile } from "@/lib/database-inspection";

export async function createConsistentDatabaseCopy(
  sourcePath: string,
  destinationPath: string,
) {
  await mkdir(path.dirname(destinationPath), {
    recursive: true,
    mode: 0o700,
  });
  const client = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve(sourcePath)}` } },
  });

  try {
    await vacuumInto(client, destinationPath);
  } finally {
    await client.$disconnect();
  }

  return inspectDatabaseFile(destinationPath);
}

export async function vacuumInto(
  client: PrismaClient,
  destinationPath: string,
) {
  await rm(destinationPath, { force: true });
  try {
    await client.$executeRawUnsafe(
      `VACUUM INTO '${destinationPath.replaceAll("'", "''")}'`,
    );
    await chmod(destinationPath, 0o600);
  } catch (error) {
    await rm(destinationPath, { force: true });
    throw error;
  }
}
