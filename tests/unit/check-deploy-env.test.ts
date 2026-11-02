import { describe, expect, it } from "vitest";
import { checkDeployEnv } from "../../scripts/check-deploy-env.mjs";

const VALID = {
  DATABASE_URL: "postgres://powermeals:pw@127.0.0.1:5432/powermeals",
  REDIS_URL: "redis://:pw@127.0.0.1:6379/0",
  PASSWORD_PEPPER: "x".repeat(44),
  NEXT_PUBLIC_SITE_URL: "https://powermeals.mx",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
  TURNSTILE_SECRET_KEY: "secret",
  ORDER_EMAIL_FROM: "pedidos@powermeals.mx",
  AWS_REGION: "us-west-2",
  NEXT_PUBLIC_SENTRY_DSN: "https://key@o1.ingest.sentry.io/1",
  NEXT_PUBLIC_MAPTILER_KEY: "maptiler",
  HEARTBEAT_NOTIFY_URL: "https://hc-ping.com/a",
  HEARTBEAT_DISPATCH_URL: "https://hc-ping.com/b",
  HEARTBEAT_WATCHDOG_URL: "https://hc-ping.com/c",
  HEARTBEAT_BACKUP_URL: "https://hc-ping.com/d",
  BACKUP_S3_BUCKET: "power-meals-backups",
};

describe("checkDeployEnv", () => {
  it("accepts a complete production env without warnings", () => {
    expect(checkDeployEnv(VALID)).toEqual({ errors: [], warnings: [] });
  });

  it("requires the launch variables", () => {
    const { errors } = checkDeployEnv({ ...VALID, TURNSTILE_SECRET_KEY: "", ORDER_EMAIL_FROM: undefined });
    expect(errors).toEqual(["TURNSTILE_SECRET_KEY is not set", "ORDER_EMAIL_FROM is not set"]);
  });

  it("rejects the .env.example placeholders and a short pepper", () => {
    const { errors } = checkDeployEnv({
      ...VALID,
      DATABASE_URL: "postgres://powermeals:CHANGE_ME@127.0.0.1:5432/powermeals",
      PASSWORD_PEPPER: "short",
    });
    expect(errors).toEqual(["DATABASE_URL still contains CHANGE_ME", "PASSWORD_PEPPER must be at least 32 characters"]);
  });

  it("rejects a site URL that is not public https", () => {
    expect(checkDeployEnv({ ...VALID, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).errors).toEqual([
      "NEXT_PUBLIC_SITE_URL must be https (it is inlined into the build)",
      "NEXT_PUBLIC_SITE_URL points at localhost",
    ]);
    expect(checkDeployEnv({ ...VALID, NEXT_PUBLIC_SITE_URL: "powermeals.mx" }).errors).toEqual([
      "NEXT_PUBLIC_SITE_URL is not a URL",
    ]);
  });

  it("rejects half-configured Openpay, WhatsApp and Sentry builds", () => {
    const { errors } = checkDeployEnv({
      ...VALID,
      OPENPAY_MERCHANT_ID: "m",
      OPENPAY_PRIVATE_KEY: "k",
      WHATSAPP_TOKEN: "t",
      SENTRY_AUTH_TOKEN: "s",
    });
    expect(errors).toEqual([
      "OPENPAY_WEBHOOK_USER, OPENPAY_WEBHOOK_PASSWORD must be set together with OPENPAY_MERCHANT_ID, OPENPAY_PRIVATE_KEY",
      "WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME must be set together with WHATSAPP_TOKEN",
      "SENTRY_ORG, SENTRY_PROJECT must be set together with SENTRY_AUTH_TOKEN",
    ]);
  });

  it("warns about Openpay sandbox, a local SQS endpoint and missing monitoring, without failing", () => {
    const { errors, warnings } = checkDeployEnv({
      ...VALID,
      OPENPAY_MERCHANT_ID: "m",
      OPENPAY_PRIVATE_KEY: "k",
      OPENPAY_WEBHOOK_USER: "u",
      OPENPAY_WEBHOOK_PASSWORD: "p",
      OPENPAY_SANDBOX_MODE: "true",
      SQS_ENDPOINT: "http://localhost:9324",
      HEARTBEAT_BACKUP_URL: "",
      BACKUP_S3_BUCKET: undefined,
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      "Openpay is in sandbox mode (OPENPAY_SANDBOX_MODE is not false)",
      "SQS_ENDPOINT is set; leave it empty on AWS",
      "HEARTBEAT_BACKUP_URL is not set",
      "BACKUP_S3_BUCKET is not set",
    ]);
  });
});
