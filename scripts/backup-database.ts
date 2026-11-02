import { log } from "../lib/log";
import { backupDatabase } from "../lib/ops/backup";
import { runJob } from "./run-job";

/**
 * Run nightly by deploy/systemd/power-meals-backup.timer. Streams pg_dump to S3; the bucket's lifecycle rule
 * deletes dumps after 30 days. A failed dump or upload crashes the job, so Sentry and the backup check both alert.
 */
void runJob("db.backup", process.env.HEARTBEAT_BACKUP_URL, async () => {
  const result = await backupDatabase();
  log.info("db.backup.uploaded", result);
  return { ok: true, summary: { key: result.key, bytes: result.bytes, seconds: result.seconds } };
});
