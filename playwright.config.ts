import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const testDataDirectory = process.env.KIROCREW_SCRATCH ?? path.resolve("data");
const databaseUrl = `file:${path.join(testDataDirectory, "personal-expense-tracker-e2e.db")}`;

process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "tsx e2e/global-setup.ts && npm run dev -- --hostname 127.0.0.1",
    env: { DATABASE_URL: databaseUrl },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
  },
});
