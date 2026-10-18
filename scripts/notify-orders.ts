import { getPool } from "../lib/db";
import { sendPendingOrderNotifications } from "../lib/orders/notify";

/** Run by deploy/systemd/power-meals-notify.timer to retry paid-order messages the app could not send. */
sendPendingOrderNotifications()
  .then((results) => {
    if (results.sent || results.pending || results.failed) {
      console.info(JSON.stringify({ event: "order.notify_retry", ...results }));
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
