import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type PublicStatus = "pending" | "paid" | "failed" | "whatsapp";

type OrderStatus = (typeof schema.orderStatus.enumValues)[number];

export function toPublicStatus(status: OrderStatus): PublicStatus {
  if (status === "pending_payment") return "pending";
  if (status === "cancelled") return "failed";
  if (status === "ordered_whatsapp") return "whatsapp";
  return "paid";
}

export type ReceiptLine = { displayName: string; quantity: number; lineTotalCents: number; slots: string[] };

/** What a holder of the order_ref may see. Never includes the phone number or internal ids beyond the owner check. */
export type PublicReceipt = {
  ref: string;
  orderNumber: number;
  status: PublicStatus;
  createdAt: Date;
  paidAt: Date | null;
  customerName: string;
  customerEmail: string;
  ownerUserId: string | null;
  fulfillment: { type: "delivery" | "pickup"; place: string; address: string | null; schedule: string | null };
  notes: string | null;
  lines: ReceiptLine[];
  totalCents: number;
};

export async function getPublicStatus(ref: string) {
  const [row] = await getDb()
    .select({ status: schema.orders.status, paidAt: schema.orders.paidAt })
    .from(schema.orders)
    .where(eq(schema.orders.publicOrderRef, ref))
    .limit(1);
  return row ? { status: toPublicStatus(row.status), paidAt: row.paidAt?.toISOString() ?? null } : null;
}

/** Loads by public_order_ref only; no session involved, since the Openpay redirect arrives without pm_session. */
export async function getPublicReceipt(ref: string): Promise<PublicReceipt | null> {
  const db = getDb();
  const [order] = await db
    .select({
      id: schema.orders.id,
      orderNumber: schema.orders.orderNumber,
      status: schema.orders.status,
      createdAt: schema.orders.createdAt,
      paidAt: schema.orders.paidAt,
      customerName: schema.orders.customerName,
      customerEmail: schema.orders.customerEmail,
      userId: schema.orders.userId,
      fulfillmentType: schema.orders.fulfillmentType,
      deliveryAddress: schema.orders.deliveryAddress,
      zoneName: schema.deliveryZones.name,
      zoneDays: schema.deliveryZones.deliveryDaysLabel,
      pointName: schema.pickupPoints.name,
      pointAddress: schema.pickupPoints.address,
      pointHours: schema.pickupPoints.hoursLabel,
      notes: schema.orders.notes,
      totalCents: schema.orders.totalCents,
    })
    .from(schema.orders)
    .leftJoin(schema.deliveryZones, eq(schema.deliveryZones.id, schema.orders.deliveryZoneId))
    .leftJoin(schema.pickupPoints, eq(schema.pickupPoints.id, schema.orders.pickupPointId))
    .where(eq(schema.orders.publicOrderRef, ref))
    .limit(1);
  if (!order) return null;

  const rows = await db
    .select({
      id: schema.orderLineItems.id,
      parentLineId: schema.orderLineItems.parentLineId,
      displayName: schema.orderLineItems.displayName,
      quantity: schema.orderLineItems.quantity,
      lineTotalCents: schema.orderLineItems.lineTotalCents,
    })
    .from(schema.orderLineItems)
    .where(eq(schema.orderLineItems.orderId, order.id))
    .orderBy(asc(schema.orderLineItems.sortOrder));

  const lines = rows
    .filter((row) => !row.parentLineId)
    .map((row) => ({
      displayName: row.displayName,
      quantity: row.quantity,
      lineTotalCents: row.lineTotalCents,
      slots: rows.filter((slot) => slot.parentLineId === row.id).map((slot) => slot.displayName),
    }));

  const delivery = order.fulfillmentType === "delivery";
  return {
    ref,
    orderNumber: order.orderNumber,
    status: toPublicStatus(order.status),
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    ownerUserId: order.userId,
    fulfillment: {
      type: order.fulfillmentType,
      place: (delivery ? order.zoneName : order.pointName) ?? "",
      address: delivery ? order.deliveryAddress : order.pointAddress,
      schedule: delivery ? order.zoneDays : order.pointHours,
    },
    notes: order.notes,
    lines,
    totalCents: order.totalCents,
  };
}
