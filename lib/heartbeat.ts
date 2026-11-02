import { errorMessage, log } from "@/lib/log";

const TIMEOUT_MS = 5_000;

/**
 * Pings a Healthchecks.io check. Unset URL is a no-op (dev, tests). Never throws: a monitoring outage must not
 * fail the job it monitors. `body` shows up in the check's event log, so keep it to counts and ids.
 */
export async function pingHeartbeat(url: string | undefined, outcome: "success" | "fail", body?: string) {
  if (!url) return;
  const target = outcome === "fail" ? `${url.replace(/\/+$/, "")}/fail` : url;
  try {
    const response = await fetch(target, { method: "POST", body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) log.warn("heartbeat.ping_failed", { status: response.status });
  } catch (error) {
    log.warn("heartbeat.ping_failed", { message: errorMessage(error) });
  }
}
