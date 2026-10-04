import { rmSync } from "node:fs";
import { prepareTestDatabase } from "../test/prepare-database";

prepareTestDatabase(process.env.DATABASE_URL);

if (process.env.BACKUP_DIRECTORY) {
  rmSync(process.env.BACKUP_DIRECTORY, { recursive: true, force: true });
}
