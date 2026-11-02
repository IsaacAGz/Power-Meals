import { log } from "../lib/log";
import { sendPendingOrderNotifications } from "../lib/orders/notify";
import { runJob } from "./run-job";

/** Run by deploy/systemd/power-meals-notify.timer to retry paid-order messages the app could not send. */
void runJob("order.notify_retry", process.env.HEARTBEAT_NOTIFY_URL, async () => {
  const results = await sendPendingOrderNotifications();
  if (results.sent || results.pending || results.failed) log.info("order.notify_retry", results);
  // Rows that end up failed are reported by the watchdog; this check only says the timer ran.
  return { ok: true, summary: results };
});
