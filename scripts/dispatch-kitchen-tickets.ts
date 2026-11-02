import { sendPendingKitchenTickets } from "../lib/kitchen/dispatch";
import { log } from "../lib/log";
import { runJob } from "./run-job";

/** Run by deploy/systemd/power-meals-dispatch.timer to retry tickets the app could not send to SQS. */
void runJob("kitchen.dispatch_retry", process.env.HEARTBEAT_DISPATCH_URL, async () => {
  const results = await sendPendingKitchenTickets();
  if (results.sent || results.pending || results.failed) log.info("kitchen.dispatch_retry", results);
  // Rows that end up failed are reported by the watchdog; this check only says the timer ran.
  return { ok: true, summary: results };
});
