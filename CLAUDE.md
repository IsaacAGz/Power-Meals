# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The runtime model (routes, order lifecycle, statuses, auth, printing, notifications, safe-change rules) lives in the Cursor rule below and is the main reference for how the app behaves. When it, `PLAN.md` (phase tracker), `power-meals.md` (portfolio brief) or `power-meals-v2.md` (original prompt) disagree, follow the code.

@.cursor/rules/application.mdc

## Commands

Node 22 (`.node-version`). Postgres and Redis run locally; anything that touches them (dev server, migrations, seed, integration and e2e tests, scripts) must run outside the sandbox.

```bash
npm run dev                 # next dev (copies the MapLibre worker into public/ first)
npm run build && npm start
npm run lint                # eslint
npx tsc --noEmit            # typecheck

npm run db:generate         # drizzle-kit generate from lib/db/schema.ts into drizzle/
npm run db:migrate
npm run db:seed             # catalog, kitchens, pickup points
STAFF_PASSWORD=... npm run user:create-staff -- --email <email> --name <name> --facility <slug>

npm run kitchen:dispatch    # retry the kitchen_dispatches outbox (SQS)
npm run orders:notify       # retry the order_notifications outbox (email / WhatsApp)
npm run ops:watchdog        # report failed/stuck outbox rows and stale paid orders (alert.* logs + heartbeat)
npm run db:backup           # pg_dump streamed to s3://$BACKUP_S3_BUCKET (needs pg_dump on PATH and AWS credentials)
```

Scripts that import app code run with `tsx --conditions=react-server` so `server-only` modules load outside Next. Timer scripts go through `scripts/run-job.ts` (Sentry, Healthchecks.io ping, closing Postgres and Redis).

### Tests

```bash
npm test                    # Vitest: unit (node) + components (jsdom), no services needed
npm run test:integration    # Vitest: real Postgres + Redis, one file at a time
npm run test:all
npm run test:e2e            # Playwright, desktop + mobile projects

npx vitest run tests/unit/pricing.test.ts            # single file
npx vitest run --project unit -t "some test name"    # single test by name
npx playwright test e2e/ordering.spec.ts --project desktop
```

- Integration and e2e tests use the `powermeals_test` database and Redis DB 15, derived from `.env` by `tests/setup/test-env.ts` (override with `TEST_DATABASE_URL` / `TEST_REDIS_URL`). It refuses non-`_test` databases and Redis DB 0 because tests truncate tables and flush Redis. Create the database once: `sudo -u postgres createdb -O powermeals powermeals_test`. Migrations and seed run automatically in global setup.
- Every external service (SES, SQS, WhatsApp, Openpay, Turnstile, MapTiler) is off in tests unless a test turns it on.
- Playwright starts its own `next dev` on port 3100 with `NEXT_DIST_DIR=.next-e2e`, seeding one customer and one Otay staff user (`e2e/support.ts`).
- `server-only` is stubbed for Vitest (`tests/stubs/server-only.ts`); test data helpers are in `tests/helpers/`.

## Layout

- `app/` — App Router pages (Spanish route names) and `app/api/` route handlers. Handlers stay thin and call into `lib/`.
- `lib/` — server logic by domain: `orders/` (creation, WhatsApp claim, payment, notify outbox, public receipt), `kitchen/` (status transitions, dispatch outbox), `auth/` (DAL, password, Turnstile, verify/reset tokens), `session/`, `cart/`, `catalog/` (pricing shared with the browser as preview only), `db/` (Drizzle schema + seed), `email/` (SES), `sqs/`, `openpay/`. `lib/env.ts` reads configuration; `lib/ui.ts` holds brand tokens; `lib/format.ts` formats integer-cent money.
- `drizzle/` — SQL migrations generated from `lib/db/schema.ts` by `npm run db:generate`.
- `packages/print-daemon/` — separate Node package (own `package.json`) that consumes the SQS queue and prints 80mm tickets for one kitchen.
- `scripts/` — CLI entry points behind the npm scripts above.
- `deploy/`, `docs/ec2-setup.md` — EC2 deployment (systemd, nginx), SQS printing setup, and backups and restore (section 11). `scripts/deploy.sh` deploys on the server into `/srv/power-meals/releases/` with a `current` symlink and handles rollback; migrations run before the switch, so they must stay compatible with the release still running.

## Observability

- Log with `log.info|warn|error("domain.event", fields)` from `lib/log.ts`, not `console.*`. It writes one JSON line and masks phone/email/address fields and drops secrets; rsyslog ships those lines to CloudWatch, where `level = "error"` and `alert.*` events raise alarms. Pass `requestId(request)` from route handlers.
- Sentry (`instrumentation.ts`, `instrumentation-client.ts`, `app/error.tsx`, `app/global-error.tsx`) is off unless `NEXT_PUBLIC_SENTRY_DSN` is set. `lib/sentry-options.ts` disables the SDK's default header/cookie/body/query/local-variable collection and scrubs `order_ref` and `token` from URLs; keep it that way.
- Setup for Sentry, Healthchecks.io, CloudWatch and UptimeRobot is in `docs/ec2-setup.md` section 10.
