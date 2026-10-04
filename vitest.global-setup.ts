import { prepareTestDatabase } from "./test/prepare-database";

export default function globalSetup() {
  prepareTestDatabase(process.env.DATABASE_URL);
}
