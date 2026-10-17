import { getPool } from "../lib/db";
import { sendPendingKitchenTickets } from "../lib/kitchen/dispatch";

/** Run by deploy/systemd/power-meals-dispatch.timer to retry tickets the app could not send to SQS. */
sendPendingKitchenTickets()
  .then((results) => {
    if (results.sent || results.pending || results.failed) {
      console.info(JSON.stringify({ event: "kitchen.dispatch_retry", ...results }));
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
