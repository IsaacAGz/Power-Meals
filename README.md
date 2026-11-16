# Power Meals

Spanish (es-MX) ordering site for a weekly meal-prep kitchen in Tijuana. Customers build plates or pick POWER packages, then order for pickup at one of four kitchens. Each kitchen's staff move the order along on a dashboard, and the customer follows it on a receipt link.

Orders are placed through WhatsApp and paid by bank transfer, which is how the kitchen takes payment today. Card checkout (Openpay), the WhatsApp Cloud API message and kitchen ticket printing (SQS) are built, and each stays off until its credentials are set.

**Status:** runs locally; the production deploy to EC2 and `powermealstj.com` is in progress. See [`PLAN.md`](./PLAN.md).

## Stack

- Next.js 16 (App Router, Node server), React 19, TypeScript, Tailwind CSS v4
- PostgreSQL with Drizzle ORM; Redis for sessions, guest carts and rate limits
- Argon2id passwords with a server-side pepper; Cloudflare Turnstile on registration and password reset
- Amazon SES (email), Amazon SQS and a small print daemon (kitchen tickets), Openpay (cards, off)
- MapLibre GL with the OpenFreeMap Positron style, recolored to the brand
- Vitest and Playwright; Sentry, Healthchecks.io and CloudWatch in production

## Run it locally

Requires Node 22 (`.node-version`), PostgreSQL and Redis running on your machine.

```bash
npm install
cp .env.example .env          # then fill it in (below)

# Database and role, once
sudo -u postgres psql -c "CREATE ROLE powermeals LOGIN PASSWORD 'choose-one';"
sudo -u postgres createdb -O powermeals powermeals

npm run db:migrate
npm run db:seed               # catalog, kitchens, pickup points
npm run dev                   # http://localhost:3000
```

In `.env`, at least:

- `DATABASE_URL` and `REDIS_URL` for your local services (`redis://127.0.0.1:6379/0` if Redis has no password)
- `PASSWORD_PEPPER`: `openssl rand -base64 32`
- Turnstile: a widget that allows `localhost`, or Cloudflare's test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`)
- `ORDER_EMAIL_FROM` and AWS credentials for SES. Registration sends a confirmation email and refuses to create accounts without a sender. To sign in without it, create a kitchen staff account (below), which is confirmed already.

Everything else (Openpay, SQS, WhatsApp, Sentry, heartbeats) can stay empty; each feature is off until it is set.

A kitchen staff account, for `/kitchen/dashboard`:

```bash
STAFF_PASSWORD=... npm run user:create-staff -- --email cocina@example.com --name "Cocina Otay" --facility otay
```

## Commands

```bash
npm run dev                 # development server
npm run build && npm start  # production build
npm run lint
npx tsc --noEmit            # typecheck

npm test                    # unit and component tests, no services needed
npm run test:integration    # real PostgreSQL and Redis
npm run test:e2e            # Playwright, desktop and mobile

npm run db:generate         # SQL migration from lib/db/schema.ts
npm run db:migrate
npm run db:seed
```

Integration and end-to-end tests use a separate `powermeals_test` database and Redis database 15, and refuse to run against anything else because they wipe them. Create it once with `sudo -u postgres createdb -O powermeals powermeals_test`. Operations scripts (`orders:notify`, `kitchen:dispatch`, `ops:watchdog`, `db:backup`, `email:test`) are listed in [`CLAUDE.md`](./CLAUDE.md#commands).

## Layout

| Path | Contents |
|---|---|
| `app/` | Pages (Spanish routes) and API route handlers under `app/api/` |
| `lib/` | Server logic by domain: orders, kitchen, auth, session, cart, catalog, db, email, SQS, Openpay |
| `components/` | React components |
| `drizzle/` | Generated SQL migrations |
| `packages/print-daemon/` | Kitchen ticket printer service, its own package ([README](./packages/print-daemon/README.md)) |
| `scripts/` | CLI entry points behind the npm scripts, and the deploy script |
| `deploy/` | systemd units, Nginx, rsyslog and CloudWatch config for the server |
| `tests/`, `e2e/` | Vitest suites and Playwright specs |

## Deployment

One EC2 instance runs Next.js, PostgreSQL and Redis behind Nginx and CloudFront. [`docs/ec2-setup.md`](./docs/ec2-setup.md) covers it end to end, from launching the instance (section 0) to backups and restore (section 11). After setup, every deploy is:

```bash
sudo /srv/power-meals/current/scripts/deploy.sh          # builds main, migrates, switches, health-checks
sudo /srv/power-meals/current/scripts/deploy.sh rollback
```

## Documentation

- [`PLAN.md`](./PLAN.md): what is left before and after launch
- [`docs/ec2-setup.md`](./docs/ec2-setup.md): server setup and operations
- [`power-meals.md`](./power-meals.md): product and design brief
- [`CLAUDE.md`](./CLAUDE.md): commands, tests, layout and observability notes for contributors
