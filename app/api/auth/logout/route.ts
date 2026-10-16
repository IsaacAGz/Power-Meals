import { forbiddenOrigin, type AuthResponse } from "@/lib/auth/responses";
import { isSameOrigin } from "@/lib/request";
import { destroySession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  await destroySession();
  return Response.json({ ok: true, redirectTo: "/" } satisfies AuthResponse);
}
