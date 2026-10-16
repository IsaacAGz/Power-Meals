// Nginx sets X-Real-IP from the connection (or from CloudFront via set_real_ip_from), so it is trusted here.
// The app listens on 127.0.0.1 only; nothing else can reach it to forge these headers.
export function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}

export function clientIpFromHeaders(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export function siteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) throw new Error("Missing required environment variable NEXT_PUBLIC_SITE_URL");
  return value.replace(/\/+$/, "");
}

/** Route Handlers don't get the Origin check that Server Actions do, so state-changing handlers call this. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const allowed = new Set<string>();
  const host = request.headers.get("host");
  if (host) allowed.add(host);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      allowed.add(new URL(siteUrl).host);
    } catch {}
  }
  return allowed.has(originHost);
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
