# EC2 server setup (Phase 0)

How the Node.js app, PostgreSQL, and Redis run on the existing EC2 instance. Commands assume Ubuntu with systemd; adjust package names for Amazon Linux.

```mermaid
flowchart LR
  Browser --> CloudFront
  CloudFront --> Nginx["Nginx :443"]
  Nginx --> Next["next start 127.0.0.1:3000"]
  Next --> PG["PostgreSQL 127.0.0.1:5432"]
  Next --> Redis["Redis 127.0.0.1:6379"]
```

## 1. App user and layout

```bash
sudo useradd --system --no-create-home --home-dir /srv/power-meals --shell /usr/sbin/nologin powermeals
sudo install -d -o powermeals -g powermeals /srv/power-meals
sudo -u powermeals git clone <repo-url> /srv/power-meals
```

Node 22.9 or newer is required (`.node-version` pins 22; `db:seed` relies on `--env-file-if-exists`).

## 2. Secrets

```bash
sudo -u powermeals cp /srv/power-meals/.env.example /srv/power-meals/.env
sudo -u powermeals nano /srv/power-meals/.env
sudo chmod 600 /srv/power-meals/.env
```

The systemd unit loads this file through `EnvironmentFile`. Nothing secret lives in the repo or in the unit file.

`PASSWORD_PEPPER` (`openssl rand -base64 32`) is mixed into every password hash. If it is lost or changed, nobody can log in, so back it up alongside the database credentials.

## 3. PostgreSQL (localhost only)

The data directory must sit on an **encrypted EBS volume** (enable encryption when creating the volume; it cannot be toggled on an existing one).

`postgresql.conf`:

```
listen_addresses = 'localhost'
password_encryption = scram-sha-256
```

`pg_hba.conf` (remove any `0.0.0.0/0` or `::/0` lines):

```
local   all          postgres                    peer
host    powermeals   powermeals   127.0.0.1/32   scram-sha-256
host    powermeals   powermeals   ::1/128        scram-sha-256
```

```bash
sudo -u postgres psql -c "CREATE ROLE powermeals LOGIN PASSWORD '<strong-password>';"
sudo -u postgres psql -c "CREATE DATABASE powermeals OWNER powermeals;"
sudo systemctl restart postgresql
```

`gen_random_uuid()` is built in from PostgreSQL 13, so no extensions are needed.

## 4. Redis (localhost only, password, bounded memory)

`/etc/redis/redis.conf`:

```
bind 127.0.0.1 -::1
protected-mode yes
port 6379
requirepass <strong-password>
maxmemory 256mb
maxmemory-policy volatile-lru
```

`volatile-lru` only evicts keys that carry a TTL. Sessions, guest carts, and rate-limit counters all have TTLs, so under memory pressure Redis drops the least recently used of those instead of failing writes on unrelated keys.

```bash
sudo systemctl restart redis-server
redis-cli -a '<strong-password>' ping   # PONG
```

## 5. Security groups

Inbound rules on the instance:

| Port | Source | Purpose |
|------|--------|---------|
| 443 | CloudFront origin-facing prefix list (`com.amazonaws.global.cloudfront.origin-facing`) | HTTPS from CloudFront |
| 80 | Same prefix list | Redirect / ACME challenge |
| 22 | Admin IP only (or SSM Session Manager, no rule) | SSH |

No rules for 5432, 6379, or 3000. Both data stores also bind to localhost, so a misconfigured security group alone does not expose them.

## 6. Deploy

```bash
cd /srv/power-meals
sudo -u powermeals git pull
sudo -u powermeals npm ci
sudo -u powermeals npm run db:migrate
sudo -u powermeals npm run db:seed        # idempotent upsert of catalog, zones, pickup points, kitchens
sudo -u powermeals npm run build
sudo systemctl restart power-meals
```

First install of the service:

```bash
sudo cp deploy/systemd/power-meals.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now power-meals
journalctl -u power-meals -f
```

`db:seed` is safe to re-run: it upserts by slug and never deletes rows, except that each seeded meal template's filter tags are replaced with the ones in [`lib/catalog/seed-data.ts`](../lib/catalog/seed-data.ts). Zone and pickup-point routing to kitchens can be changed directly in the database; re-seeding does not overwrite `kitchen_facility_id` on existing zones or points.

### Kitchen staff accounts

Staff can't self-register. Create each account for one kitchen (`zona-rio`, `otay`, `plaza-monarca`, `rio-tijuana-3ra-etapa`):

```bash
cd /srv/power-meals
read -rs STAFF_PASSWORD && export STAFF_PASSWORD   # typed without echo, kept out of shell history
sudo -u powermeals --preserve-env=STAFF_PASSWORD npm run user:create-staff -- \
  --email cocina.otay@powermeals.mx --name "Cocina Otay" --facility otay
unset STAFF_PASSWORD
```

Staff log in at `/ingresar` and land on `/kitchen/dashboard`, which only shows their own kitchen.

### Openpay

1. Set `OPENPAY_MERCHANT_ID`, `OPENPAY_PRIVATE_KEY`, `OPENPAY_SANDBOX_MODE`, `OPENPAY_WEBHOOK_USER` and `OPENPAY_WEBHOOK_PASSWORD` in `.env`, and make sure `NEXT_PUBLIC_SITE_URL=https://powermeals.mx` before building. Without the merchant ID and key, `/pedido` hides the card button and offers WhatsApp only.
2. In the Openpay dashboard, add a webhook for `https://powermeals.mx/api/webhooks/openpay` with the same user and password (basic auth). Openpay sends a verification request first; paste the logged `verificationCode` back into the dashboard:

   ```bash
   journalctl -u power-meals | grep '"type":"verification"'
   ```

3. Subscribe at least `charge.succeeded`, `charge.failed` and `charge.cancelled`. The handler re-fetches every charge from the Openpay API and trusts only that status, so a forged body cannot mark an order paid.

### Kitchen printing (SQS)

Each kitchen PC runs [`packages/print-daemon`](../packages/print-daemon/README.md). The app sends one ticket to a shared SQS queue the first time an order becomes paid: staff confirming a WhatsApp transfer on the dashboard, or an Openpay `charge.succeeded`. Duplicate webhooks and later status changes send nothing.

1. Create the dead-letter queue `power-meals-kitchen-dlq` (standard queue, retention 14 days).
2. Create `power-meals-kitchen` (standard queue): visibility timeout 60 s, retention 4 days, receive wait 20 s, redrive to the DLQ with **maxReceiveCount 1000**. The count is high on purpose: every daemon receives every kitchen's tickets and hands back the ones that aren't its own, and each hand-back counts as a receive.
3. Add a CloudWatch alarm on the DLQ's `ApproximateNumberOfMessagesVisible` > 0.
4. Give the EC2 instance role `sqs:SendMessage` on `power-meals-kitchen` only, then set `SQS_QUEUE_URL` and `AWS_REGION` in `.env` and restart the app.
5. Create an IAM user for the kitchen PCs with only `sqs:ReceiveMessage`, `sqs:DeleteMessage` and `sqs:ChangeMessageVisibility` on the same queue. One shared key is acceptable while the PCs are trusted; rotate it when a PC is replaced or staff with access leave.
6. Install the retry timer. Every paid order writes a `kitchen_dispatches` row in the same transaction; the app sends it right after responding, and the timer retries anything still `pending` (SQS outage, restart before the send). After 60 failed attempts a row becomes `failed`.

   ```bash
   sudo cp deploy/systemd/power-meals-dispatch.service deploy/systemd/power-meals-dispatch.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now power-meals-dispatch.timer
   ```

Tickets that land in the DLQ (a kitchen PC was off too long, or a payload the daemon can't read) can be sent back with **Start DLQ redrive** in the SQS console once the cause is fixed. To see what the app could not send:

```bash
psql "$DATABASE_URL" -c "select o.order_number, d.status, d.attempts, d.last_error from kitchen_dispatches d join orders o on o.id = d.order_id where d.status <> 'sent' order by d.created_at desc limit 20"
```

## 7. Nginx

Merge [`deploy/nginx/powermeals.conf`](../deploy/nginx/powermeals.conf) into the existing config. Uncomment the `set_real_ip_from` block with CloudFront's origin-facing ranges; without it every rate limit applies per CloudFront edge rather than per client.

Security headers (CSP, HSTS, frame denial) are sent by Next.js from [`next.config.ts`](../next.config.ts), so Nginx does not need to add them.

## 8. Health check

```bash
curl -s http://127.0.0.1:3000/api/health
# {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

Returns `503` with `"degraded"` and the failing check when PostgreSQL or Redis is unreachable. Nginx only allows it from localhost by default.

## 9. CloudFront behaviors

| Path pattern | Cache policy | Notes |
|--------------|--------------|-------|
| `/_next/static/*` | CachingOptimized | Hashed filenames, immutable |
| `/images/*`, `/maplibre/*`, `/logo.svg` | CachingOptimized | Public assets |
| `/api/*` | CachingDisabled | Forward all headers, cookies, query strings |
| `/kitchen/*`, `/cuenta*`, `/historial*`, `/ingresar*`, `/registro*`, `/pedido*` | CachingDisabled | Session-bound pages; `/pedido*` also covers the Openpay return pages, which must forward the `order_ref` and `id` query strings |
| Default (`*`) | UseOriginCacheControlHeaders | Static marketing pages send `public` headers; dynamic ones send `private, no-store` |

Forward the session cookie only on the uncached behaviors so cached responses never vary by user.

## Cloudflare static deploy

`main` still builds the static export for Cloudflare Workers. The `v2` branch removes `output: "export"` and cannot produce `out/`, so do not run `wrangler deploy` from it. Cloudflare is retired in Phase 5 once EC2 is stable (see [PLAN.md](../PLAN.md)).
