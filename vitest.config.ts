import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

const testDataDirectory =
  process.env.KIROCREW_SCRATCH ?? path.resolve(rootDirectory, "data");
process.env.DATABASE_URL = `file:${path.join(
  testDataDirectory,
  "personal-expense-tracker-unit.db",
)}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  test: {
    globals: true,
    globalSetup: ["./vitest.global-setup.ts"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
