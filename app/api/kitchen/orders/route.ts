import { requireKitchenStaff } from "@/lib/auth/dal";
import { getKitchenBoard } from "@/lib/kitchen/orders";
import { hitRateLimit } from "@/lib/rate-limit";

/** The dashboard polls this. The session cookie is SameSite=Strict, so another site cannot read it. */
export async function GET() {
  const user = await requireKitchenStaff("/kitchen/dashboard");
  const limit = await hitRateLimit(`kitchen:poll:${user.id}`, 40, 60);
  if (!limit.allowed) return Response.json({ message: "Demasiadas consultas." }, { status: 429 });

  const board = await getKitchenBoard(user.kitchenFacilityId);
  return Response.json(board, { headers: { "Cache-Control": "no-store" } });
}
