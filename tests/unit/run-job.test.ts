import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn(), flush: vi.fn(async () => true) }));
const pingHeartbeat = vi.hoisted(() => vi.fn(async () => {}));
const poolEnd = vi.hoisted(() => vi.fn(async () => {}));
const closeRedis = vi.hoisted(() => vi.fn());

vi.mock("@sentry/node", () => sentry);
vi.mock("@/lib/heartbeat", () => ({ pingHeartbeat }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ end: poolEnd }) }));
vi.mock("@/lib/redis", () => ({ closeRedis }));

const { runJob } = await import("../../scripts/run-job");

const URL = "https://hc-ping.com/job";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.exitCode = undefined;
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function expectCleanedUp() {
  expect(sentry.flush).toHaveBeenCalled();
  expect(poolEnd).toHaveBeenCalledOnce();
  expect(closeRedis).toHaveBeenCalledOnce();
}

describe("runJob", () => {
  it("pings success with the summary when the job is ok", async () => {
    await runJob("test.job", URL, async () => ({ ok: true, summary: { sent: 2 } }));

    expect(pingHeartbeat).toHaveBeenCalledWith(URL, "success", '{"sent":2}');
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expectCleanedUp();
  });

  it("pings /fail when the job reports a problem, without treating it as a crash", async () => {
    await runJob("test.job", URL, async () => ({ ok: false, summary: { alerts: 1 } }));

    expect(pingHeartbeat).toHaveBeenCalledWith(URL, "fail", '{"alerts":1}');
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expectCleanedUp();
  });

  it("reports a crash to Sentry and the log, pings /fail, exits 1, and still closes connections", async () => {
    const error = new Error("database is down");
    await runJob("test.job", URL, async () => {
      throw error;
    });

    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(pingHeartbeat).toHaveBeenCalledWith(URL, "fail", '{"error":"database is down"}');
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toMatchObject({
      level: "error",
      event: "test.job.crashed",
      message: "database is down",
    });
    expect(process.exitCode).toBe(1);
    expectCleanedUp();
  });
});
