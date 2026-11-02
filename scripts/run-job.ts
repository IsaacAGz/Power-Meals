import * as Sentry from "@sentry/node";
import { getPool } from "../lib/db";
import { pingHeartbeat } from "../lib/heartbeat";
import { errorMessage, log } from "../lib/log";
import { closeRedis } from "../lib/redis";
import { sentryOptions } from "../lib/sentry-options";

type JobResult = { ok: boolean; summary?: Record<string, unknown> };

/**
 * Wraps a systemd timer job: reports a crash to Sentry, pings its Healthchecks.io check (success, or /fail when
 * the job crashed or returned ok: false), and closes Postgres and Redis so the process exits.
 */
export async function runJob(event: string, heartbeatUrl: string | undefined, job: () => Promise<JobResult>) {
  Sentry.init(sentryOptions());

  let ok = false;
  let summary: Record<string, unknown> | undefined;
  try {
    ({ ok, summary } = await job());
  } catch (error) {
    log.error(`${event}.crashed`, { message: errorMessage(error) });
    Sentry.captureException(error);
    summary = { error: errorMessage(error) };
    process.exitCode = 1;
  }

  await pingHeartbeat(heartbeatUrl, ok ? "success" : "fail", summary ? JSON.stringify(summary) : undefined);
  await Sentry.flush(2_000);
  await getPool().end();
  closeRedis();
}
