import { log } from "../lib/log";
import { redisMemory, runWatchdogChecks } from "../lib/ops/watchdog";
import { runJob } from "./run-job";

/**
 * Run by deploy/systemd/power-meals-watchdog.timer. Each problem is logged as alert.<check> (a CloudWatch alarm
 * matches those) and turns the Healthchecks.io check red; a clean run turns it green again.
 */
void runJob("watchdog", process.env.HEARTBEAT_WATCHDOG_URL, async () => {
  const alerts = await runWatchdogChecks();
  for (const { check, ...fields } of alerts) log.error(`alert.${check}`, fields);

  const { evictedKeys } = await redisMemory();
  log.info("watchdog.ran", { alerts: alerts.length, redisEvictedKeys: evictedKeys });
  return { ok: alerts.length === 0, summary: { alerts } };
});
