# Power Meals print daemon

Runs on one PC in each kitchen. It long-polls the shared SQS queue, prints the tickets for its own kitchen on an 80 mm ESC/POS printer, and hands every other kitchen's tickets back to the queue. Queue setup is in [`docs/ec2-setup.md`](../../docs/ec2-setup.md#kitchen-printing-sqs).

## Install

Requires Node.js 22.18 or newer (it runs the TypeScript sources directly, no build step).

```bash
sudo useradd --system --create-home powermeals-printer
sudo mkdir -p /opt/power-meals-printer
sudo cp -r package.json package-lock.json src deploy .env.example /opt/power-meals-printer/
cd /opt/power-meals-printer
sudo npm ci --omit=dev
sudo cp .env.example .env && sudo chmod 600 .env && sudo chown powermeals-printer .env
sudo editor .env    # QUEUE_URL, AWS keys, KITCHEN_FACILITY_ID, PRINTER_TARGET
```

For a USB printer on Linux, add the user to the printer group: `sudo usermod -aG lp powermeals-printer`.

Check the printer before connecting to the queue:

```bash
sudo -u powermeals-printer npm run test-print
```

Then install the service:

```bash
sudo cp deploy/power-meals-printer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now power-meals-printer
journalctl -u power-meals-printer -f
```

On a Windows PC, run `npm start` from the install folder as a service (for example with NSSM) so it restarts on boot.

## What happens to a ticket

| Outcome | Queue action |
|---------|--------------|
| Printed | Deleted |
| Printer offline, out of paper, timeout | Kept; hidden for `PRINT_RETRY_VISIBILITY_SECONDS` (default 120), doubling per failure up to 300 s, then retried |
| Another kitchen's ticket | Handed back after `OTHER_FACILITY_VISIBILITY_SECONDS` (default 5) |
| Same order delivered twice | Deleted without printing (remembered while the daemon runs) |
| Unreadable payload | Retried like a print failure until the queue moves it to the DLQ |

The poll loop never sleeps for a backoff: a failed ticket waits on the queue side while the daemon keeps receiving. Each line of output is JSON (`printed`, `print_failed`, `duplicate`, `receive_failed`) for `journalctl`.

## Ticket contract

The message body is the `KitchenTicket` type in [`src/contract.ts`](src/contract.ts), which the web app imports too. Message attributes `kitchen_facility_id` and `order_id` carry the routing key and the order for tracing.
