import { and, eq, isNull, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/dal";
import { addCartItems, CartError, ensureCartOwner, getPricedCart } from "@/lib/cart";
import { toCartView } from "@/lib/cart/view";
import { getCatalog } from "@/lib/catalog";
import { parseCartItem, resolveLine } from "@/lib/catalog/pricing";
import { getDb, schema } from "@/lib/db";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Pedir de nuevo": copies the lines of one of the user's past orders into the cart. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ message: "Solicitud no permitida." }, { status: 403 });

  const limit = await hitRateLimit(`reorder:ip:${clientIp(request)}`, 30, 60);
  if (!limit.allowed) return Response.json({ message: "Demasiadas solicitudes." }, { status: 429 });

  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Inicia sesión para repetir un pedido." }, { status: 401 });

  const body = await readJsonBody(request);
  const orderId = typeof body?.orderId === "string" && UUID_PATTERN.test(body.orderId) ? body.orderId : null;
  if (!orderId) return Response.json({ message: "Solicitud inválida." }, { status: 400 });

  const rows = await getDb()
    .select({ item: schema.orderLineItems.item, quantity: schema.orderLineItems.quantity })
    .from(schema.orderLineItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderLineItems.orderId))
    .where(
      and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.userId, user.id),
        ne(schema.orders.status, "cancelled"),
        isNull(schema.orderLineItems.parentLineId),
      ),
    )
    .orderBy(schema.orderLineItems.sortOrder);

  const catalog = await getCatalog();
  const items = rows.flatMap((row) => {
    const parsed = parseCartItem(row.item);
    if (!parsed) return [];
    const item = parsed.kind === "meal" ? { ...parsed, source: "reorder" as const } : parsed;
    return resolveLine(catalog, item, row.quantity) ? [{ item, quantity: row.quantity }] : [];
  });
  if (items.length === 0) {
    return Response.json({ message: "Los platillos de este pedido ya no están disponibles." }, { status: 409 });
  }

  const owner = await ensureCartOwner();
  try {
    await addCartItems(owner, items);
  } catch (error) {
    if (error instanceof CartError) return Response.json({ message: error.message }, { status: 400 });
    throw error;
  }
  return Response.json({ ...toCartView(await getPricedCart(owner)), skipped: rows.length - items.length });
}
