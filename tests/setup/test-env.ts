import { existsSync } from "node:fs";

const TEST_DATABASE = "powermeals_test";
const TEST_REDIS_DB = "15";

/**
 * Points the process at the test database and Redis database 15, derived from .env.
 * Override with TEST_DATABASE_URL / TEST_REDIS_URL. Refuses anything that does not look like a test target,
 * because every test truncates tables and flushes Redis.
 */
export function applyTestEnv() {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const database = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://powermeals@127.0.0.1:5432/");
  if (!process.env.TEST_DATABASE_URL) database.pathname = `/${TEST_DATABASE}`;
  if (!database.pathname.endsWith("_test")) throw new Error(`Refusing to test against database ${database.pathname}`);

  const redis = new URL(process.env.TEST_REDIS_URL ?? process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  if (!process.env.TEST_REDIS_URL) redis.pathname = `/${TEST_REDIS_DB}`;
  if (redis.pathname === "" || redis.pathname === "/" || redis.pathname === "/0") {
    throw new Error("Refusing to test against Redis database 0");
  }

  Object.assign(process.env, {
    DATABASE_URL: database.toString(),
    DATABASE_POOL_MAX: "5",
    REDIS_URL: redis.toString(),
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    PASSWORD_PEPPER: "test-pepper-test-pepper-test-pepper-0000",
    ORDER_EMAIL_FROM: "pedidos@powermeals.test",
    TURNSTILE_SECRET_KEY: "test-secret",
    AWS_REGION: "us-west-2",
    // Off unless a test turns them on.
    SQS_QUEUE_URL: "",
    SQS_ENDPOINT: "",
    WHATSAPP_TOKEN: "",
    WHATSAPP_PHONE_NUMBER_ID: "",
    WHATSAPP_TEMPLATE_NAME: "",
    OPENPAY_MERCHANT_ID: "",
    OPENPAY_PRIVATE_KEY: "",
  });
}
