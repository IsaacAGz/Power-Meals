# EC2 server setup

How the Node.js app, PostgreSQL, and Redis run on one EC2 instance behind CloudFront. Section 0 creates the instance; sections 1–11 set it up, in order. Commands assume Ubuntu 24.04 with systemd.

```mermaid
flowchart LR
  Browser --> CloudFront
  CloudFront --> Nginx["Nginx :443"]
  Nginx --> Next["next start 127.0.0.1:3000"]
  Next --> PG["PostgreSQL 127.0.0.1:5432"]
  Next --> Redis["Redis 127.0.0.1:6379"]
```

## 0. Create the instance

Do this once, before section 1. It creates the instance, its fixed address and DNS name, installs the software the later sections expect, and gets the two TLS certificates: one on the server for Nginx, one in ACM for CloudFront.

### Decisions first

- **Region.** `us-west-2` (Oregon), the default in `.env.example`. SES, SQS, S3 and the instance all use this one `AWS_REGION`.
- **DNS.** The commands below assume `powermealstj.com` is a Cloudflare DNS zone (the old static site is deployed there). For Route 53, see the note under [Origin certificate](#origin-certificate-nginx).
- **Hostnames.**

  | Name | Points at | Used for |
  |---|---|---|
  | `origin.powermealstj.com` | The Elastic IP (A record; in Cloudflare, **DNS only**, not proxied) | CloudFront's origin. Browsers never use it. |
  | `staging.powermealstj.com` | The CloudFront distribution (CNAME) | The smoke test before the cutover. Turnstile allows it as a subdomain of `powermealstj.com`. |
  | `powermealstj.com`, `www` | The old static site until the [cutover](../PLAN.md#production-cutover), then CloudFront | The live site |

### Launch the instance

EC2 console → **Launch instance**:

| Setting | Value | Why |
|---|---|---|
| Name | `power-meals` | |
| AMI | Ubuntu Server 24.04 LTS (64-bit) | The commands in this guide are for Ubuntu. |
| Type | `t4g.medium` (ARM, 4 GB) or `t3.medium` (x86, 4 GB) | Postgres, Redis and Node share the box, and every deploy runs `next build` on it. With 2 GB (`.small`), add the swap file below. |
| Key pair | None (use Session Manager), or one kept offline | No SSH port is opened in section 5. |
| Network | Default VPC, a public subnet, auto-assign public IP off (the Elastic IP replaces it) | |
| Security group | New, `power-meals`, rules from [section 5](#5-security-groups) | |
| Storage | 30 GiB gp3, **Encrypted: yes** (default `aws/ebs` key), volume tag `Backup=power-meals` | The PostgreSQL data lives here. Encryption cannot be turned on later. The tag is what the daily snapshot policy (section 11) looks for. |
| IAM instance profile | Role `power-meals-ec2` (new, or created ahead in IAM as an EC2 role) with `AmazonSSMManagedInstanceCore` and `CloudWatchAgentServerPolicy` | Shell access without SSH, and the CloudWatch agent (section 10). SES, SQS and the backup bucket are added to this role later (sections 6 and 11). |
| Advanced → Termination protection | Enable | |
| Advanced → Metadata version | V2 only (token required) | The default for new instances; keep it. |

Then:

1. **Elastic IP.** EC2 → Elastic IPs → Allocate → Associate with the instance. Without it the public address changes on every stop and start.
2. **Origin DNS record.** In Cloudflare DNS add `A origin <Elastic IP>`, proxy status **DNS only**.
3. **Connect.** EC2 → the instance → Connect → Session Manager, or from your machine `aws ssm start-session --target <instance-id>`. Shells open as `ssm-user`, who has sudo.

### Base packages

```bash
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y git curl ca-certificates unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades    # answer Yes: security updates install automatically
sudo timedatectl set-timezone UTC                  # logs and backup keys are UTC; the app formats in America/Tijuana itself
```

**Swap** (only on an instance with 2 GB of memory):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Node.js 22** from NodeSource. Ubuntu's own `nodejs` package is too old, and the systemd units run `/usr/bin/node`, so do not use nvm here.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs
which node && node --version    # /usr/bin/node, v22.9 or newer
```

**PostgreSQL 18** from the PostgreSQL project's repository, the version CI tests against. Its `pg_dump` is the one the nightly backup uses. Configure it in [section 3](#3-postgresql-localhost-only); the files are under `/etc/postgresql/18/main/`.

```bash
sudo apt-get install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt-get install -y postgresql-18
```

**Redis** from Ubuntu (7.x; the app needs 6.2 or newer). Configure it in [section 4](#4-redis-localhost-only-password-bounded-memory).

```bash
sudo apt-get install -y redis-server
```

**Nginx and the AWS CLI.** Nginx is configured in [section 7](#7-nginx); the CLI is used for the backup restore and the CloudWatch commands.

```bash
sudo apt-get install -y nginx
sudo rm /etc/nginx/sites-enabled/default    # nothing should answer for unknown hostnames
sudo snap install aws-cli --classic
```

### Origin certificate (Nginx)

CloudFront connects to the instance over HTTPS, so Nginx needs a certificate for every name CloudFront may send as the `Host`: `origin.powermealstj.com`, plus `powermealstj.com` and `www` for the behaviors that forward the viewer's `Host` (section 9).

The certificate uses Let's Encrypt's **DNS challenge**. The usual HTTP challenge cannot work here: `powermealstj.com` points at the old site until the cutover, and port 80 only accepts CloudFront (section 5). The DNS challenge needs neither, and renewals run on their own.

1. In Cloudflare: My Profile → API Tokens → Create token → template **Edit zone DNS**, zone resources: `powermealstj.com` only.
2. On the server:

   ```bash
   sudo snap install --classic certbot
   sudo ln -s /snap/bin/certbot /usr/bin/certbot
   sudo snap set certbot trust-plugin-with-root=ok
   sudo snap install certbot-dns-cloudflare

   sudo install -m 600 /dev/null /etc/letsencrypt/cloudflare.ini
   sudo nano /etc/letsencrypt/cloudflare.ini    # one line: dns_cloudflare_api_token = <token>

   sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
     --cert-name powermealstj.com -d powermealstj.com -d www.powermealstj.com -d origin.powermealstj.com \
     --deploy-hook "systemctl reload nginx"
   sudo certbot renew --dry-run
   ```

The files land in `/etc/letsencrypt/live/powermealstj.com/`, the paths [`deploy/nginx/powermeals.conf`](../deploy/nginx/powermeals.conf) uses. The snap's timer renews them and reloads Nginx.

On Route 53 instead: `sudo snap install certbot-dns-route53`, give the instance role `route53:ListHostedZones`, `route53:GetChange` and `route53:ChangeResourceRecordSets` on the zone, and use `--dns-route53` with no credentials file.

### CloudFront certificate (ACM)

CloudFront only takes certificates from ACM in **`us-east-1`**, whatever region the instance is in. Request it now; it is attached to the distribution in [section 9](#9-cloudfront-behaviors).

1. ACM console, region **N. Virginia (us-east-1)** → Request → public certificate.
2. Names: `powermealstj.com`, `www.powermealstj.com`, `staging.powermealstj.com`. Validation: DNS.
3. Add the CNAME records ACM shows to Cloudflare (**DNS only**). The certificate is issued within minutes and renews itself while those records stay.

Continue with section 1.

## 1. App user and layout

```
/srv/power-meals/
  repo.git/                 mirror of the GitHub repo, fetched on every deploy
  shared/.env               the only .env; each release links to it
  releases/<n>-<UTC time>-<sha>/  one per deploy: source, node_modules, .next (the newest 5 are kept)
  current -> releases/...   the running release; every systemd unit runs from here
```

```bash
sudo useradd --system --no-create-home --home-dir /srv/power-meals --shell /usr/sbin/nologin powermeals
sudo install -d -o powermeals -g powermeals /srv/power-meals /srv/power-meals/shared /srv/power-meals/releases
```

The server pulls from GitHub with a read-only **deploy key** (repository → Settings → Deploy keys, write access off):

```bash
sudo install -d -m 700 -o powermeals -g powermeals /srv/power-meals/.ssh
sudo -u powermeals ssh-keygen -t ed25519 -N '' -C power-meals-deploy -f /srv/power-meals/.ssh/id_ed25519
sudo cat /srv/power-meals/.ssh/id_ed25519.pub     # paste into the deploy key
sudo -u powermeals git clone --mirror git@github.com:<owner>/<repo>.git /srv/power-meals/repo.git
```

Node 22.9 or newer is required (`.node-version` pins 22; `db:seed` relies on `--env-file-if-exists`).

From section 6 on, commands with a relative path (`deploy/...`, `npm run ...`) run from `/srv/power-meals/current`.

## 2. Secrets

```bash
sudo -u powermeals git --git-dir=/srv/power-meals/repo.git show main:.env.example | sudo -u powermeals tee /srv/power-meals/shared/.env >/dev/null
sudo chmod 600 /srv/power-meals/shared/.env
sudo -u powermeals nano /srv/power-meals/shared/.env
```

The systemd units load this file through `EnvironmentFile`, and each release has a `.env` symlink to it for the `npm run` scripts. Nothing secret lives in the repo or in the unit files. The deploy script checks it before every build (`scripts/check-deploy-env.mjs`): a missing launch variable, a `CHANGE_ME` left from the example, a short pepper, or a non-https `NEXT_PUBLIC_SITE_URL` stops the deploy; missing monitoring or backup variables only print a warning.

After editing it: a `NEXT_PUBLIC_*` variable is inlined at build time, so run a deploy (section 6). For any other variable, `sudo systemctl restart power-meals` is enough, and the timers read the file on their next run.

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
| 80 | Same prefix list | Redirect to HTTPS. Certificates use the DNS challenge (section 0), so Let's Encrypt never needs this port. |
| 22 | Admin IP only (or SSM Session Manager, no rule) | SSH |

No rules for 5432, 6379, or 3000. Both data stores also bind to localhost, so a misconfigured security group alone does not expose them.

## 6. Deploy

[`scripts/deploy.sh`](../scripts/deploy.sh) does every deploy, as root:

```bash
sudo /srv/power-meals/current/scripts/deploy.sh            # main
sudo /srv/power-meals/current/scripts/deploy.sh <ref>      # a branch, tag or sha
```

1. Fetches the mirror and exports the commit into a new `releases/<number>-<UTC time>-<sha>/` (no `.git`; the sha is in `REVISION`).
2. Checks `shared/.env` (section 2).
3. `npm ci`, `npm run build`, then `npm run db:migrate`. The running release keeps serving all this time. If any step fails, the new release is deleted and nothing else changes.
4. Updates the systemd unit files that are already installed and changed, and lists the ones that are not installed.
5. Points `current` at the new release, restarts `power-meals` and waits up to 60 s for `/api/health` to answer 200. The timers pick up `current` on their next run.
6. If the health check fails, it marks the release bad, switches back to the previous one, restarts and exits with an error.
7. Deletes all but the newest 5 releases.

Only one deploy or rollback runs at a time.

**Migrations run before the switch**, so the release that is still running must keep working with the new schema: add columns and tables in one deploy, and stop using or drop the old ones in a later one. Neither a rollback nor a failed health check undoes a migration. The deploy does not take a backup. Before a deploy whose migration changes or drops data, take one by hand with `sudo systemctl start power-meals-backup.service`. Restoring that dump (section 11) is the only way to undo the migration.

**Rollback** switches back to the newest earlier release that was not marked bad, without building. The release it leaves is marked bad, so a second rollback goes further back instead of returning to it:

```bash
sudo /srv/power-meals/current/scripts/deploy.sh list               # releases, with current and bad marked
sudo /srv/power-meals/current/scripts/deploy.sh rollback           # previous good release
sudo /srv/power-meals/current/scripts/deploy.sh rollback <name>    # a specific one
```

To go forward again, deploy the ref again: a new release is built from it.

**First deploy.** There is no `current` yet, so run the script from the mirror. Until `power-meals.service` is installed it only builds and switches `current`, without restarting anything. Then install the service, seed, and deploy once more the normal way:

```bash
sudo -u powermeals git --git-dir=/srv/power-meals/repo.git show main:scripts/deploy.sh > /tmp/deploy.sh
sudo bash /tmp/deploy.sh main
cd /srv/power-meals/current
sudo cp deploy/systemd/power-meals.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now power-meals
curl -s http://127.0.0.1:3000/api/health
sudo -u powermeals npm run db:seed        # idempotent upsert of catalog, zones, pickup points, kitchens
sudo /srv/power-meals/current/scripts/deploy.sh   # a normal deploy, to confirm the script end to end
journalctl -u power-meals -f
```

`db:seed` is not part of the deploy. Run it from `/srv/power-meals/current` after a deploy that changes [`lib/catalog/seed-data.ts`](../lib/catalog/seed-data.ts). It is safe to re-run: it upserts by slug and never deletes rows, except that each seeded meal template's filter tags are replaced with the ones in [`lib/catalog/seed-data.ts`](../lib/catalog/seed-data.ts). Zone and pickup-point routing to kitchens can be changed directly in the database; re-seeding does not overwrite `kitchen_facility_id` on existing zones or points.

### Kitchen staff accounts

Staff can't self-register. Create each account for one kitchen (`zona-rio`, `otay`, `plaza-monarca`, `rio-tijuana-3ra-etapa`):

```bash
cd /srv/power-meals/current
read -rs STAFF_PASSWORD && export STAFF_PASSWORD   # typed without echo, kept out of shell history
sudo -u powermeals --preserve-env=STAFF_PASSWORD npm run user:create-staff -- \
  --email cocina.otay@powermealstj.com --name "Cocina Otay" --facility otay
unset STAFF_PASSWORD
```

Staff log in at `/ingresar` and land on `/kitchen/dashboard`, which only shows their own kitchen.

### Openpay

1. Set `OPENPAY_MERCHANT_ID`, `OPENPAY_PRIVATE_KEY`, `OPENPAY_SANDBOX_MODE`, `OPENPAY_WEBHOOK_USER` and `OPENPAY_WEBHOOK_PASSWORD` in `.env`, and make sure `NEXT_PUBLIC_SITE_URL=https://powermealstj.com` before building. Without the merchant ID and key, `/pedido` hides the card button and offers WhatsApp only.
2. In the Openpay dashboard, add a webhook for `https://powermealstj.com/api/webhooks/openpay` with the same user and password (basic auth). Openpay sends a verification request first; paste the logged `verificationCode` back into the dashboard:

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

### Paid-order email (SES)

The first transition to paid messages the customer once, with the receipt link. An order with an email is sent through SES. An order with a phone and no email is sent through the WhatsApp Cloud API (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_TEMPLATE_NAME` for an approved es_MX utility template whose body variables are first name, order number, and receipt link). Later kitchen steps do not send again. Give the EC2 role `ses:SendEmail` for the verified identity, set `ORDER_EMAIL_FROM` to that from-address (same `AWS_REGION` as SQS), and install the retry timer. A channel left unset records the row as `skipped`, so setting it later does not message old orders. The `/contacto` form sends from that same address to `CONTACT_EMAIL_TO`; while SES is in sandbox mode, verify that inbox as an identity too.

```bash
sudo cp deploy/systemd/power-meals-notify.service deploy/systemd/power-meals-notify.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now power-meals-notify.timer
```

To check SES before relying on it, send the paid-order email (fake order #0) to one address. It prints whether the account is still in the sandbox, whether the from-address and domain are verified, and the DKIM status. In the sandbox the recipient must be verified too.

```bash
npm run email:test -- you@example.com                                   # locally, with an AWS profile
cd /srv/power-meals/current && sudo -u powermeals npm run email:test -- you@example.com   # on EC2 (the release links shared/.env)
```

```bash
psql "$DATABASE_URL" -c "select o.order_number, n.channel, n.status, n.attempts, n.last_error from order_notifications n join orders o on o.id = n.order_id where n.status <> 'sent' order by n.created_at desc limit 20"
```

## 7. Nginx

Behind CloudFront, nginx sees an edge IP, so every rate limit (including 5 logins a minute) would be shared by everyone on the same edge. The server block restores the viewer IP from `X-Forwarded-For`, trusting only CloudFront's origin-facing ranges. Those ranges come from AWS's `ip-ranges.json` and change over time, so [`scripts/cloudfront-real-ip.mjs`](../scripts/cloudfront-real-ip.mjs) writes them to `/etc/nginx/snippets/cloudfront-real-ip.conf` and a daily timer keeps them current. It replaces the file only when the ranges change, checks it with `nginx -t` (restoring the old list if that fails) and reloads nginx. A failed run logs `cloudfront_ips.failed`, a `level = "error"` line the CloudWatch alarm picks up; nginx keeps the last good list meanwhile.

Create the list before merging the server block, since the block includes it:

```bash
cd /srv/power-meals/current
sudo node scripts/cloudfront-real-ip.mjs     # writes /etc/nginx/snippets/cloudfront-real-ip.conf
sudo cp deploy/systemd/power-meals-cloudfront-ips.service deploy/systemd/power-meals-cloudfront-ips.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now power-meals-cloudfront-ips.timer
```

Then install [`deploy/nginx/powermeals.conf`](../deploy/nginx/powermeals.conf). It needs the certificate from [section 0](#origin-certificate-nginx). On an Nginx that already serves other sites, merge it instead, since the rate-limit zones may exist under other names.

```bash
sudo cp deploy/nginx/powermeals.conf /etc/nginx/sites-available/powermeals.conf
sudo ln -s /etc/nginx/sites-available/powermeals.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

 To check it, sign in once through the site and look at the access log: the client address should be your own IP, not a CloudFront one (`130.176.*`, `64.252.*` and similar).

Security headers (CSP, HSTS, frame denial) are sent by Next.js from [`next.config.ts`](../next.config.ts), so Nginx does not need to add them.

## 8. Health check

```bash
curl -s http://127.0.0.1:3000/api/health
# {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

Returns `503` with `"degraded"` and the failing check when PostgreSQL or Redis is unreachable. Nginx only allows it from localhost by default.

## 9. CloudFront behaviors

Create the distribution with:

- **Origin:** `origin.powermealstj.com`, protocol **HTTPS only**, minimum origin SSL protocol TLSv1.2.
- **Alternate domain names:** `staging.powermealstj.com` for the smoke test. Add `powermealstj.com` and `www.powermealstj.com` at the cutover.
- **Custom SSL certificate:** the ACM certificate from [section 0](#cloudfront-certificate-acm).
- **Viewer protocol policy:** Redirect HTTP to HTTPS.

On every uncached behavior below, use the **AllViewer** origin request policy, so the app sees the viewer's `Host`. The Origin checks on route handlers and Server Actions compare against it, and the kitchen board's status changes fail without it. Then add a CNAME `staging` → the distribution's `*.cloudfront.net` name (DNS only).

| Path pattern | Cache policy | Notes |
|--------------|--------------|-------|
| `/_next/static/*` | CachingOptimized | Hashed filenames, immutable |
| `/images/*`, `/maplibre/*`, `/brand/*` | CachingOptimized | Public assets |
| `/api/*` | CachingDisabled | Forward all headers, cookies, query strings |
| `/kitchen/*`, `/cuenta*`, `/historial*`, `/ingresar*`, `/registro*`, `/pedido*` | CachingDisabled | Session-bound pages; `/pedido*` also covers the Openpay return pages, which must forward the `order_ref` and `id` query strings |
| `/monitoring*` | CachingDisabled | Sentry tunnel: browser errors are POSTed here, so allow all HTTP methods |
| Default (`*`) | UseOriginCacheControlHeaders | Static marketing pages send `public` headers; dynamic ones send `private, no-store` |

Forward the session cookie only on the uncached behaviors so cached responses never vary by user.

## 10. Observability

Each tool covers one question. All of them are free or cost a few dollars a month at this traffic.

| Question | Tool | Alerts when |
|---|---|---|
| Is the site up? | UptimeRobot (free) | `https://powermealstj.com/` or `/menu` stops answering, or the TLS certificate is about to expire |
| Did a timer or a kitchen printer stop? | Healthchecks.io (free) | A check misses its ping, or receives `/fail` |
| Did an order, message or ticket get stuck? | Watchdog timer + Healthchecks.io | `npm run ops:watchdog` finds a problem (see below) |
| Did code throw? | Sentry (free Developer plan) | A new error type, or a spike |
| What happened around it? | CloudWatch Logs | `level` is `error` more than a few times, or any `alert.*` line |
| Is the disk or memory full? | CloudWatch agent | Disk > 80 %, memory > 90 % |

### Sentry

1. Create a Next.js project in Sentry. Set `NEXT_PUBLIC_SENTRY_DSN` in `.env` (and `NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging` on a staging box), then deploy again (section 6): the DSN is inlined into the browser bundle.
2. Optional: set `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` (an org token with source map upload) so `npm run build` uploads source maps and removes them from `.next`.
3. Browser errors go to `/monitoring` on this site and the server forwards them, so the CSP is unchanged. Add the `/monitoring*` CloudFront behavior from section 9.

[`lib/sentry-options.ts`](../lib/sentry-options.ts) turns off the SDK's default collection of headers, cookies, request bodies, query strings and stack-frame variables, and scrubs `order_ref` and `token` from URLs. Only the stack trace and the route are sent.

### Healthchecks.io

Create one check per row and put its ping URL in the matching `.env` (the kitchen ones in each PC's print-daemon `.env`):

| Check | Variable | Period | Grace |
|---|---|---|---|
| Notify retry timer | `HEARTBEAT_NOTIFY_URL` | 1 min | 5 min |
| Dispatch retry timer | `HEARTBEAT_DISPATCH_URL` | 1 min | 5 min |
| Watchdog | `HEARTBEAT_WATCHDOG_URL` | 5 min | 10 min |
| Nightly database backup ([section 11](#11-backups)) | `HEARTBEAT_BACKUP_URL` | 1 day | 2 h |
| One per kitchen printer | `HEARTBEAT_URL` (print daemon) | 1 min | 5 min |

Add an email (or the free Telegram integration) to the project. The watchdog check also goes red when PostgreSQL or Redis is unreachable, because the run fails.

### Watchdog

Runs every 5 minutes and logs one `alert.<check>` line per problem, with the order numbers:

| Check | Meaning |
|---|---|
| `notify.failed`, `dispatch.failed` | A paid-order message or kitchen ticket gave up after 60 attempts (last 24 h) |
| `notify.stuck`, `dispatch.stuck` | Still pending after `WATCHDOG_NOTIFY_STALE_MINUTES` (15) / `WATCHDOG_DISPATCH_STALE_MINUTES` (5) |
| `orders.paid_not_started` | Paid for more than `WATCHDOG_PAID_STALE_MINUTES` (60) and not yet `preparing` |
| `openpay.amount_mismatch` | A card charge did not match the order total (last 24 h) |
| `redis.memory_high` | Redis is above 90 % of `maxmemory` and will start evicting sessions and carts |

```bash
sudo cp deploy/systemd/power-meals-watchdog.service deploy/systemd/power-meals-watchdog.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now power-meals-watchdog.timer
sudo -u powermeals npm run ops:watchdog   # one run by hand
```

### CloudWatch Logs and host metrics

The app writes one JSON line per event ([`lib/log.ts`](../lib/log.ts)) with phones, emails and addresses masked. The CloudWatch agent reads files, not journald, so rsyslog copies those lines to `/var/log/power-meals/app.log`; `journalctl` keeps working as before.

1. Attach `CloudWatchAgentServerPolicy` to the EC2 instance role.
2. rsyslog and log rotation (the units' `SyslogIdentifier` is what the rule matches, so copy the updated units first):

   ```bash
   sudo cp deploy/systemd/power-meals*.service /etc/systemd/system/ && sudo systemctl daemon-reload
   sudo systemctl restart power-meals
   sudo cp deploy/rsyslog/30-power-meals.conf /etc/rsyslog.d/
   sudo cp deploy/rsyslog/power-meals.logrotate /etc/logrotate.d/power-meals
   sudo systemctl restart rsyslog
   tail -f /var/log/power-meals/app.log    # one JSON object per line
   ```

3. Install the agent and load [`deploy/cloudwatch/amazon-cloudwatch-agent.json`](../deploy/cloudwatch/amazon-cloudwatch-agent.json):

   ```bash
   sudo apt-get install -y ./amazon-cloudwatch-agent.deb   # from the AWS download page for your architecture
   sudo usermod -aG adm cwagent                            # read /var/log/power-meals and nginx logs
   sudo cp deploy/cloudwatch/amazon-cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s \
     -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
   ```

4. Metric filters, an SNS topic and the alarms:

   ```bash
   TOPIC=$(aws sns create-topic --name power-meals-alerts --query TopicArn --output text)
   aws sns subscribe --topic-arn "$TOPIC" --protocol email --notification-endpoint <you@example.com>

   aws logs put-metric-filter --log-group-name /power-meals/app --filter-name errors \
     --filter-pattern '{ $.level = "error" }' \
     --metric-transformations metricName=AppErrors,metricNamespace=PowerMeals,metricValue=1,defaultValue=0
   aws logs put-metric-filter --log-group-name /power-meals/app --filter-name alerts \
     --filter-pattern '{ $.event = "alert.*" }' \
     --metric-transformations metricName=WatchdogAlerts,metricNamespace=PowerMeals,metricValue=1,defaultValue=0

   alarm() { aws cloudwatch put-metric-alarm --alarm-actions "$TOPIC" --ok-actions "$TOPIC" \
     --treat-missing-data notBreaching --evaluation-periods 1 "$@"; }
   alarm --alarm-name power-meals-errors --namespace PowerMeals --metric-name AppErrors \
     --statistic Sum --period 300 --threshold 5 --comparison-operator GreaterThanOrEqualToThreshold
   alarm --alarm-name power-meals-watchdog --namespace PowerMeals --metric-name WatchdogAlerts \
     --statistic Sum --period 300 --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold
   ```

   Add the disk and memory alarms from the console (CloudWatch → Alarms → `PowerMeals` namespace → `disk_used_percent` for `/` above 80, `mem_used_percent` above 90), since their dimensions depend on the instance.

Query recent errors in **Logs Insights** on `/power-meals/app`:

```
fields ts, event, orderId, message | filter level = "error" | sort ts desc | limit 50
```

`requestId` on a line matches `$request_id` from Nginx, so one request can be followed across lines.

### UptimeRobot

`/api/health` only answers localhost (section 8), so from outside monitor the pages: a keyword monitor on `https://powermealstj.com/` for `Power Meals`, an HTTP monitor on `https://powermealstj.com/menu`, and SSL expiry alerts. Database and Redis outages are caught by the watchdog check above.

## 11. Backups

Two layers. Redis holds only sessions, carts and rate-limit counters, so it is not backed up; losing it signs everyone out.

| Layer | What | When | Kept | Restores |
|---|---|---|---|---|
| `pg_dump` to S3 | Logical dump of the `powermeals` database (`--format=custom`) | 03:30 Tijuana time, nightly | 30 days | One database, on this or any other server |
| EBS snapshots (Data Lifecycle Manager) | The whole encrypted data volume | Daily | 7 snapshots | The whole volume, as it was at snapshot time |

The dump is the main backup: it is small, portable and tested by the restore drill. The snapshot covers what the dump does not, such as a broken instance or `.env` on the same volume.

Neither layer holds `PASSWORD_PEPPER` separately. Keep it with the database credentials (section 2), outside AWS. A dump restored without the same pepper loads fine, but no one can log in.

### S3 bucket

Same region as `AWS_REGION`. Versioning makes a dump the instance overwrites recoverable, and the lifecycle rule deletes each dump 30 days after upload.

```bash
BUCKET=power-meals-backups-<account-id>    # bucket names are global
aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules": [{
    "ID": "postgres-30-days",
    "Filter": { "Prefix": "postgres/" },
    "Status": "Enabled",
    "Expiration": { "Days": 30 },
    "NoncurrentVersionExpiration": { "NoncurrentDays": 7 },
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
  }]
}'
```

`Expiration` deletes a dump after 30 days. `NoncurrentVersionExpiration` removes the older version left behind by that delete, or by an overwrite, a week later. `AbortIncompleteMultipartUpload` removes the parts of an upload that was killed partway.

### Instance role

Add this inline policy to the EC2 instance role. Write and read cover the nightly upload and the restore drill. There is no `s3:DeleteObject`, so the server cannot delete its own backups; only the lifecycle rule deletes them.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PowerMealsBackupObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:AbortMultipartUpload"],
      "Resource": "arn:aws:s3:::power-meals-backups-<account-id>/postgres/*"
    },
    {
      "Sid": "PowerMealsBackupList",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::power-meals-backups-<account-id>",
      "Condition": { "StringLike": { "s3:prefix": "postgres/*" } }
    }
  ]
}
```

### Nightly dump timer

`pg_dump` comes from `postgresql-client` and must be the same major version as the server or newer. On Ubuntu, the `postgresql` package already installs it. The dump streams straight to S3 and is never written to disk. If `pg_dump` fails, the upload is aborted, so a partial file never sits in the bucket looking like a good backup.

1. Set `BACKUP_S3_BUCKET` (and `BACKUP_S3_PREFIX` if it is not `postgres/`) and `HEARTBEAT_BACKUP_URL` in `.env`.
2. Install the timer and run it once:

   ```bash
   sudo cp deploy/systemd/power-meals-backup.service deploy/systemd/power-meals-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now power-meals-backup.timer
   sudo systemctl start power-meals-backup.service      # one run now; blocks until the upload finishes
   journalctl -u power-meals-backup -n 20              # db.backup.uploaded with key, bytes and seconds
   systemctl list-timers power-meals-backup.timer      # next run
   ```

A failed run logs `db.backup.crashed` (a CloudWatch `level = "error"` line), reports the error to Sentry and pings the check's `/fail`. A run that never happens (timer disabled, instance off past the grace time) turns the check red on its own.

### EBS snapshots (Data Lifecycle Manager)

Tag the volume that holds `/var/lib/postgresql` (the root volume, if PostgreSQL was not moved) and let DLM snapshot it every day:

```bash
aws ec2 create-tags --resources <vol-id> --tags Key=Backup,Value=power-meals
aws dlm create-default-role --resource-type snapshot      # once per account; creates AWSDataLifecycleManagerDefaultRole
aws dlm create-lifecycle-policy --description "power-meals daily" --state ENABLED \
  --execution-role-arn arn:aws:iam::<account-id>:role/AWSDataLifecycleManagerDefaultRole \
  --policy-details '{
    "PolicyType": "EBS_SNAPSHOT_MANAGEMENT",
    "ResourceTypes": ["VOLUME"],
    "TargetTags": [{ "Key": "Backup", "Value": "power-meals" }],
    "Schedules": [{
      "Name": "daily",
      "CreateRule": { "Interval": 24, "IntervalUnit": "HOURS", "Times": ["11:00"] },
      "RetainRule": { "Count": 7 },
      "CopyTags": true
    }]
  }'
```

`Times` is UTC. 11:00 UTC is 03:00 or 04:00 in Tijuana, depending on daylight saving time. Snapshots of an encrypted volume are encrypted too. A snapshot is crash-consistent: PostgreSQL starts from it the same way it starts after a power cut, replaying its WAL. That works because the data directory and WAL are on the same volume.

### Restore procedure

**Find a dump.** Keys are dated in UTC: `postgres/YYYY/MM/DD/powermeals-<time>Z.dump`. The AWS CLI is not part of the app; install it with `sudo snap install aws-cli --classic`.

```bash
BUCKET=power-meals-backups-<account-id>
aws s3 ls "s3://$BUCKET/postgres/" --recursive | tail -n 5
KEY=postgres/2026/11/02/powermeals-2026-11-02T10-30-05Z.dump
aws s3 cp "s3://$BUCKET/$KEY" /var/tmp/restore.dump
pg_restore --list /var/tmp/restore.dump > /dev/null && echo "archive OK"
```

**Restore into a scratch database (the drill; touches nothing live).** Do this after setup and every few months:

```bash
sudo -u postgres createdb -O powermeals powermeals_restore
sudo -u postgres pg_restore --dbname=powermeals_restore --no-owner --role=powermeals --exit-on-error /var/tmp/restore.dump
sudo -u postgres psql powermeals_restore -c "select count(*) as orders, max(created_at) as latest from orders"
sudo -u postgres dropdb powermeals_restore
rm /var/tmp/restore.dump
```

`latest` should be from the evening before the dump.

**Replace the live database.** Orders placed after the dump are lost, so take the newest dump. If PostgreSQL itself is still up, take a fresh dump first with `sudo systemctl start power-meals-backup.service`. Stop everything that writes, keep the broken database under another name, then restore:

```bash
sudo systemctl stop power-meals power-meals-notify.timer power-meals-dispatch.timer power-meals-watchdog.timer power-meals-backup.timer
sudo -u postgres psql -c "alter database powermeals rename to powermeals_broken_$(date +%Y%m%d)"
sudo -u postgres createdb -O powermeals powermeals
sudo -u postgres pg_restore --dbname=powermeals --no-owner --role=powermeals --exit-on-error /var/tmp/restore.dump
cd /srv/power-meals/current && sudo -u powermeals npm run db:migrate   # no-op unless the dump predates a migration
sudo systemctl start power-meals power-meals-notify.timer power-meals-dispatch.timer power-meals-watchdog.timer power-meals-backup.timer
curl -s http://127.0.0.1:3000/api/health
```

Check `/kitchen/dashboard` and one receipt. Drop `powermeals_broken_*` once you are sure it is not needed. Redis sessions still point at user ids from the old database. They stay valid as long as the users exist in the dump. Otherwise, `redis-cli -a '<password>' -n 0 flushdb` signs everyone out.

**Restore a whole volume (instance or disk lost).** In the EC2 console, find the newest snapshot tagged `Backup=power-meals`. Create a volume from it in the instance's availability zone, with encryption on. Then either attach it to a replacement instance in place of the lost volume, or attach it as a second disk and copy what is needed off it. PostgreSQL replays its WAL on first start. If the snapshot is older than the newest S3 dump, restore that dump on top using the steps above.

## Cloudflare static deploy

The site live on Cloudflare Workers today is an older static export. `main` is now the Node app and no longer has `output: "export"`, so it cannot produce `out/`: do not run `wrangler deploy` from it. The static deploy stays up as the fallback until the production cutover, then it is retired (see [PLAN.md](../PLAN.md#production-cutover)).
