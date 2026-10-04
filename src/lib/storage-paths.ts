import path from "node:path";

export type StoragePaths = {
  projectRoot: string;
  databasePath: string;
  dataDirectory: string;
  backupDirectory: string;
  runtimeMarkerDirectory: string;
};

export function resolveStoragePaths(
  databaseUrl = process.env.DATABASE_URL,
  projectRoot = process.cwd(),
): StoragePaths {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("DATABASE_URL must point to a local SQLite file.");
  }

  const encodedLocation = databaseUrl.slice("file:".length).split("?")[0];
  const location = decodeURIComponent(encodedLocation);
  const databasePath = path.isAbsolute(location)
    ? path.normalize(location)
    : path.resolve(projectRoot, "prisma", location);
  const dataDirectory = path.dirname(databasePath);

  return {
    projectRoot: path.resolve(projectRoot),
    databasePath,
    dataDirectory,
    backupDirectory: process.env.BACKUP_DIRECTORY
      ? path.resolve(projectRoot, process.env.BACKUP_DIRECTORY)
      : path.resolve(projectRoot, "backups"),
    runtimeMarkerDirectory: `${databasePath}-app-running`,
  };
}
