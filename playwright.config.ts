import { defineConfig, devices } from "@playwright/test";
import { applyTestEnv } from "./tests/setup/test-env";

applyTestEnv();

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * Its own Next server on port 3100, built into .next-e2e, against powermeals_test and Redis database 15.
 * Every outside service is off, so nothing is emailed, messaged, printed, or charged.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: { baseURL, trace: "retain-on-failure", locale: "es-MX", timezoneId: "America/Tijuana" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `${baseURL}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: process.env.DATABASE_URL!,
      REDIS_URL: process.env.REDIS_URL!,
      PASSWORD_PEPPER: process.env.PASSWORD_PEPPER!,
      NEXT_PUBLIC_SITE_URL: baseURL,
      ORDER_EMAIL_FROM: "",
      SQS_QUEUE_URL: "",
      WHATSAPP_TOKEN: "",
      WHATSAPP_PHONE_NUMBER_ID: "",
      WHATSAPP_TEMPLATE_NAME: "",
      OPENPAY_MERCHANT_ID: "",
      OPENPAY_PRIVATE_KEY: "",
      NEXT_PUBLIC_MAPTILER_KEY: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    },
  },
});
