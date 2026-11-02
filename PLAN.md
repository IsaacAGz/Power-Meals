# Power Meals — remaining work

The retail app is built and running locally. This file is what is left before and after the production launch on EC2. [`power-meals.md`](./power-meals.md) is the portfolio brief for the current app. `power-meals-v2.md` is the original build prompt. [`.cursor/rules/application.mdc`](./.cursor/rules/application.mdc) is the runtime model. Server steps are in [`docs/ec2-setup.md`](./docs/ec2-setup.md). When they disagree, follow the code.

## Already built

- [x] Platform: Next.js on Node, PostgreSQL, Redis sessions, Drizzle schema and seed
- [x] Customer auth, `/cuenta`, `/historial`, kitchen staff role
- [x] Accounts: email confirmation before first sign-in, Turnstile on registration and reset requests, password reset by email link
- [x] Catalog, cart, guest checkout, WhatsApp order ingestion (`ordered_whatsapp`, not paid)
- [x] Pedido: pickup only at the four kitchens (delivery shown disabled and rejected), Arma tu platillo one confirmed row at a time, plantillas fill the open row
- [x] Openpay checkout and webhook code, kept off until [Openpay](#openpay)
- [x] Kitchen dashboard, facility-scoped, 10s poll
- [x] Kitchen ticket outbox and print daemon. A real AWS queue has not been exercised; see [Real kitchen queue](#real-kitchen-queue)
- [x] Receipt tracker at `/pedido/success?order_ref=`
- [x] One message when an order first becomes Pagado: email if the order has an address, otherwise WhatsApp. Later kitchen steps send nothing
- [x] Observability: JSON logs ([`lib/log.ts`](./lib/log.ts)), Sentry, Healthchecks.io heartbeats for the timers and print daemons, and the `ops:watchdog` timer. Setup is in [`docs/ec2-setup.md`](./docs/ec2-setup.md#10-observability)
- [x] Tests: Vitest unit, component and integration suites, Playwright ordering flow

## Before production

Launch takes WhatsApp orders with a bank transfer. Card payment, the WhatsApp Cloud API message and kitchen printing are [turned on later](#turn-on-later); none of them blocks the launch.

### Code

- [x] **Database backups.** Nightly `pg_dump` to S3 (30 days), a systemd timer that pings its own Healthchecks.io check, and a written restore procedure. EBS snapshots through Data Lifecycle Manager as a second layer. See [`docs/ec2-setup.md`](./docs/ec2-setup.md#11-backups)
- [ ] **Deploy script.** `scripts/deploy.sh`: check the required env vars, `npm ci`, migrate, build, restart, wait for `/api/health`, and keep the previous build to roll back to.
- [ ] **Nginx client IP behind CloudFront.** Fill in `set_real_ip_from` in [`deploy/nginx/powermeals.conf`](./deploy/nginx/powermeals.conf). Without it every rate limit, including 5 logins a minute, is shared by everyone behind the same CloudFront edge.
- [ ] **Builder dropdowns before hydration.** A Base or Proteína picked before React hydrates `/pedido` is reset to empty (found by the Playwright test). Keep the dropdowns disabled until the page is interactive.
- [ ] **Aviso de privacidad.** `/aviso-de-privacidad`, linked from the footer, `/registro` and checkout. The text comes from a lawyer or a reviewed template.
- [ ] Merge `pedir-change` and `observability` into the main branch and push.

### Accounts and AWS console

- [x] Sentry project and DSN
- [ ] Healthchecks.io: `notify-timer`, `dispatch-timer`, `watchdog`, the backup check, and one `printer-<kitchen>` per kitchen. Pause them until the server pings
- [ ] UptimeRobot account (monitors are added at launch)
- [ ] SES: verified from-address and **production access** (out of the sandbox), or confirmation and paid-order emails only reach verified addresses
- [ ] Cloudflare Turnstile production keys for `powermeals.mx`
- [ ] EC2 instance role: `CloudWatchAgentServerPolicy`, `ses:SendEmail`, the backup bucket policy
- [ ] Backup S3 bucket with versioning and the 30-day lifecycle rule; DLM policy for daily EBS snapshots
- [ ] Aviso de privacidad text

### Server

Follow [`docs/ec2-setup.md`](./docs/ec2-setup.md) in order:

- [ ] Sections 1–5: app user, PostgreSQL, Redis with persistence on, security groups (SSH through Session Manager or the admin IP), `unattended-upgrades`
- [ ] Production `.env`, including `NEXT_PUBLIC_SITE_URL=https://powermeals.mx`, Sentry with `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production`, and the `HEARTBEAT_*` URLs. Back up `PASSWORD_PEPPER` with the database credentials
- [ ] Deploy (build after `.env` is final), seed, and one staff account per kitchen
- [ ] Notify, dispatch, watchdog and backup timers; unpause their Healthchecks.io checks
- [ ] Nginx and Let's Encrypt (`certbot renew --dry-run`)
- [ ] CloudFront behaviors, including `/monitoring*` with all HTTP methods for Sentry
- [ ] CloudWatch: rsyslog, agent, SNS topic (confirm the subscription email), metric filters and alarms
- [ ] Run one backup and restore it into a scratch database

### Smoke test

On a temporary hostname pointed at EC2, before moving DNS:

- [ ] Register, confirm the email, sign in, reset the password
- [ ] WhatsApp order as a guest and signed in
- [ ] Each kitchen account sees only its kitchen; marking an order paid sends the email and moves the receipt
- [ ] A test error reaches Sentry through CloudFront; app log lines reach CloudWatch
- [ ] The order flow on a real phone over mobile data

## Production cutover

- [ ] Point `powermeals.mx` at CloudFront/EC2
- [ ] UptimeRobot: keyword monitor on `https://powermeals.mx/` (`Power Meals`), HTTP monitor on `/menu`, SSL expiry alerts
- [ ] Watch Sentry and Healthchecks.io for the first hour; keep the Cloudflare static deploy as a fallback
- [ ] After a few stable days, retire the Cloudflare static deploy and move [`wrangler.jsonc`](./wrangler.jsonc) guidance to `docs/legacy-static-deploy.md`

## Turn on later

These are already implemented. They stay off until the outside account exists. Turning one on does not send or print a backlog: an unconfigured channel is stored as `skipped`.

### Openpay

Do not start until sandbox credentials exist. No new payment design.

- Set `OPENPAY_MERCHANT_ID`, `OPENPAY_PRIVATE_KEY`, `OPENPAY_SANDBOX_MODE=true`, `OPENPAY_WEBHOOK_USER`, and `OPENPAY_WEBHOOK_PASSWORD`. Set `NEXT_PUBLIC_SITE_URL` before building; it is inlined at build time, including the redirect URL.
- Add the Openpay domains to the CSP in [`next.config.ts`](./next.config.ts).
- Register the webhook URL in the Openpay dashboard with those basic-auth credentials. Confirm the verification code from the `openpay.webhook` log.
- Run one real sandbox payment: pending order, redirect, webhook marks `paid` once, replay is `duplicate`, guest cart clears, `/pedido/success` shows the receipt. That first success also queues the kitchen ticket and the paid-order message.
- Home, `/menu`, the footer, and `/pedido` already follow `isOpenpayConfigured()` and switch to the card-payment copy when both keys are set.

Production keys only after the sandbox payment has worked: `OPENPAY_SANDBOX_MODE=false` and webhook `https://powermeals.mx/api/webhooks/openpay`.

### WhatsApp template

The Cloud API sender is in [`lib/whatsapp-cloud.ts`](./lib/whatsapp-cloud.ts). It sends only when all three are set:

- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID` (the phone number id from Meta, not the display number)
- `WHATSAPP_TEMPLATE_NAME`

Wait until Meta approves one Spanish (`es_MX`) utility template. Body variables, in order: first name, order number, receipt link. A 10-digit Mexican number is sent as `52` plus those digits. Orders that have an email still get email only. Do not use the `wa.me` link to message the customer.

### Real kitchen queue

Code is done and was verified against a local stand-in. Creating `power-meals-kitchen`, the DLQ, and the EC2 and kitchen IAM permissions is in [`docs/ec2-setup.md`](./docs/ec2-setup.md#kitchen-printing-sqs). Set `SQS_QUEUE_URL` after that. Orders already marked `skipped` are not printed. Each kitchen PC also gets `HEARTBEAT_URL` for its `printer-<kitchen>` check.

## Later improvements

- [ ] Sentry source maps (`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` at build time), then the GitHub integration for suspect commits
- [ ] Sentry alert for a spike (more than 20 events in an hour)
- [ ] CI: lint, typecheck and Vitest on every push
- [ ] Tune `WATCHDOG_PAID_STALE_MINUTES` to kitchen hours if the overnight alert is noisy

## Routine after launch

- Weekly: Sentry triage, Healthchecks.io all green, last night's backup in S3
- Monthly: disk and CloudWatch cost, OS updates applied
- Every few months: restore a backup into a scratch database
