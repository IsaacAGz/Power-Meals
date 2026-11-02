// Checks a production .env before scripts/deploy.sh builds with it. Plain Node, no dependencies, so it runs
// before `npm ci`. Usage: node --env-file=/srv/power-meals/shared/.env scripts/check-deploy-env.mjs
// Errors stop the deploy; warnings are printed and the deploy goes on.
import { pathToFileURL } from "node:url";

/** Needed for the launch: the site, accounts (Turnstile + confirmation email) and WhatsApp orders. */
const REQUIRED = [
  "DATABASE_URL",
  "REDIS_URL",
  "PASSWORD_PEPPER",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "ORDER_EMAIL_FROM",
  "AWS_REGION",
];

/** Set all of them or none; half a group silently disables the feature or breaks the build. */
const GROUPS = [
  ["OPENPAY_MERCHANT_ID", "OPENPAY_PRIVATE_KEY", "OPENPAY_WEBHOOK_USER", "OPENPAY_WEBHOOK_PASSWORD"],
  ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TEMPLATE_NAME"],
  ["SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_AUTH_TOKEN"],
];

/** Monitoring and backups: the site works without them, but nobody hears about a problem. */
const RECOMMENDED = [
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_MAPTILER_KEY",
  "HEARTBEAT_NOTIFY_URL",
  "HEARTBEAT_DISPATCH_URL",
  "HEARTBEAT_WATCHDOG_URL",
  "HEARTBEAT_BACKUP_URL",
  "BACKUP_S3_BUCKET",
];

const PLACEHOLDER = /CHANGE_ME/;

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ errors: string[]; warnings: string[] }}
 */
export function checkDeployEnv(env) {
  const errors = [];
  const warnings = [];
  const has = (name) => Boolean(env[name]?.trim());

  for (const name of REQUIRED) if (!has(name)) errors.push(`${name} is not set`);

  for (const [name, value] of Object.entries(env)) {
    if (value && PLACEHOLDER.test(value)) errors.push(`${name} still contains CHANGE_ME`);
  }

  if (has("PASSWORD_PEPPER") && env.PASSWORD_PEPPER.length < 32) {
    errors.push("PASSWORD_PEPPER must be at least 32 characters");
  }

  if (has("NEXT_PUBLIC_SITE_URL")) {
    let url;
    try {
      url = new URL(env.NEXT_PUBLIC_SITE_URL);
    } catch {
      errors.push("NEXT_PUBLIC_SITE_URL is not a URL");
    }
    if (url && url.protocol !== "https:") errors.push("NEXT_PUBLIC_SITE_URL must be https (it is inlined into the build)");
    if (url && /^(localhost|127\.|\[?::1)/.test(url.hostname)) errors.push("NEXT_PUBLIC_SITE_URL points at localhost");
  }

  for (const group of GROUPS) {
    const set = group.filter(has);
    if (set.length > 0 && set.length < group.length) {
      errors.push(`${group.filter((name) => !has(name)).join(", ")} must be set together with ${set.join(", ")}`);
    }
  }

  if (has("OPENPAY_MERCHANT_ID") && env.OPENPAY_SANDBOX_MODE !== "false") {
    warnings.push("Openpay is in sandbox mode (OPENPAY_SANDBOX_MODE is not false)");
  }
  if (has("SQS_ENDPOINT")) warnings.push("SQS_ENDPOINT is set; leave it empty on AWS");
  for (const name of RECOMMENDED) if (!has(name)) warnings.push(`${name} is not set`);

  return { errors, warnings };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { errors, warnings } = checkDeployEnv(process.env);
  for (const warning of warnings) console.error(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (errors.length > 0) process.exit(1);
  console.error("env: ok");
}
