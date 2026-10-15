import { getPool } from "@/lib/db";
import { getRedis } from "@/lib/redis";

type CheckResult = "ok" | "error";

const CHECK_TIMEOUT_MS = 2_000;

async function runCheck(name: string, probe: () => Promise<unknown>): Promise<CheckResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timed out")), CHECK_TIMEOUT_MS);
      }),
    ]);
    return "ok";
  } catch (error) {
    console.error(`[health] ${name} check failed:`, error instanceof Error ? error.message : error);
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([
    runCheck("database", () => getPool().query("select 1")),
    runCheck("redis", () => getRedis().ping()),
  ]);
  const healthy = database === "ok" && redis === "ok";

  return Response.json(
    { status: healthy ? "ok" : "degraded", checks: { database, redis } },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
