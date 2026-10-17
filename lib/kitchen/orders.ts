import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { styleLabels, type PlateStyle } from "@/lib/catalog/types";
import { getDb, schema } from "@/lib/db";
import type { KitchenTicket } from "@/packages/print-daemon/src/contract";
import { emptyKitchenCounts, KITCHEN_STATUSES, type KitchenBoard, type KitchenLine, type KitchenOrder, type KitchenStatus } from "./types";

const ACTIVE: KitchenStatus[] = ["ordered_whatsapp", "paid", "preparing", "ready"];
const COMPLETED_LIMIT = 40;

function isKitchenStatus(value: string): value is KitchenStatus {
  return (KITCHEN_STATUSES as readonly string[]).includes(value);
}

function detailOf(row: {
  proteinGrams: number | null;
  carbGrams: number | null;
  vegGrams: number | null;
  plateStyle: PlateStyle | null;
  salsaNote: string | null;
}) {
  return [
    row.proteinGrams ? `${row.proteinGrams} g proteína` : "",
    row.carbGrams ? `${row.carbGrams} g carbohidrato` : "",
    row.vegGrams ? `${row.vegGrams} g vegetales` : "",
    row.plateStyle ? styleLabels[row.plateStyle] : "",
    row.salsaNote ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}

const orderColumns = {
  id: schema.orders.id,
  orderNumber: schema.orders.orderNumber,
  status: schema.orders.status,
  createdAt: schema.orders.createdAt,
  customerName: schema.orders.customerName,
  customerPhone: schema.orders.customerPhone,
  fulfillmentType: schema.orders.fulfillmentType,
  deliveryAddress: schema.orders.deliveryAddress,
  zoneName: schema.deliveryZones.name,
  pointName: schema.pickupPoints.name,
  pointAddress: schema.pickupPoints.address,
  notes: schema.orders.notes,
  totalCents: schema.orders.totalCents,
};

function selectOrders() {
  return getDb()
    .select(orderColumns)
    .from(schema.orders)
    .leftJoin(schema.deliveryZones, eq(schema.deliveryZones.id, schema.orders.deliveryZoneId))
    .leftJoin(schema.pickupPoints, eq(schema.pickupPoints.id, schema.orders.pickupPointId));
}

type OrderRow = {
  id: string;
  fulfillmentType: "delivery" | "pickup";
  deliveryAddress: string | null;
  zoneName: string | null;
  pointName: string | null;
  pointAddress: string | null;
};

/** Top-level lines with their package slots, keyed by order id. */
async function loadLines(orderIds: string[]): Promise<Map<string, KitchenLine[]>> {
  const byOrder = new Map<string, KitchenLine[]>();
  if (orderIds.length === 0) return byOrder;

  const rows = await getDb()
    .select({
      id: schema.orderLineItems.id,
      orderId: schema.orderLineItems.orderId,
      parentLineId: schema.orderLineItems.parentLineId,
      displayName: schema.orderLineItems.displayName,
      quantity: schema.orderLineItems.quantity,
      proteinGrams: schema.orderLineItems.proteinGrams,
      carbGrams: schema.orderLineItems.carbGrams,
      vegGrams: schema.orderLineItems.vegGrams,
      plateStyle: schema.orderLineItems.plateStyle,
      salsaNote: schema.orderLineItems.salsaNote,
    })
    .from(schema.orderLineItems)
    .where(inArray(schema.orderLineItems.orderId, orderIds))
    .orderBy(asc(schema.orderLineItems.sortOrder));

  for (const orderId of orderIds) {
    const own = rows.filter((line) => line.orderId === orderId);
    byOrder.set(
      orderId,
      own
        .filter((line) => !line.parentLineId)
        .map((line) => ({
          name: line.displayName,
          quantity: line.quantity,
          detail: detailOf(line),
          slots: own
            .filter((slot) => slot.parentLineId === line.id)
            .map((slot) => ({ name: slot.displayName, detail: detailOf(slot) })),
        })),
    );
  }
  return byOrder;
}

function fulfillmentOf(row: OrderRow) {
  const delivery = row.fulfillmentType === "delivery";
  return {
    fulfillment: row.fulfillmentType,
    place: (delivery ? row.zoneName : row.pointName) ?? "",
    address: delivery ? row.deliveryAddress : row.pointAddress,
  };
}

/** Active orders for one kitchen, plus the latest completed ones. Other facilities are not included. */
export async function getKitchenBoard(facilityId: string): Promise<KitchenBoard> {
  const db = getDb();
  const facilityFilter = eq(schema.orders.kitchenFacilityId, facilityId);

  const [facility, countRows, active, completed] = await Promise.all([
    db
      .select({ name: schema.kitchenFacilities.name })
      .from(schema.kitchenFacilities)
      .where(eq(schema.kitchenFacilities.id, facilityId))
      .limit(1),
    db
      .select({ status: schema.orders.status, value: count() })
      .from(schema.orders)
      .where(and(facilityFilter, inArray(schema.orders.status, [...KITCHEN_STATUSES])))
      .groupBy(schema.orders.status),
    selectOrders()
      .where(and(facilityFilter, inArray(schema.orders.status, ACTIVE)))
      .orderBy(asc(schema.orders.createdAt)),
    selectOrders()
      .where(and(facilityFilter, eq(schema.orders.status, "completed")))
      .orderBy(desc(schema.orders.createdAt))
      .limit(COMPLETED_LIMIT),
  ]);

  const rows = [...active, ...completed];
  const lines = await loadLines(rows.map((row) => row.id));

  const counts = emptyKitchenCounts();
  for (const row of countRows) {
    if (isKitchenStatus(row.status)) counts[row.status] = row.value;
  }

  const orders: KitchenOrder[] = rows.flatMap((row) => {
    if (!isKitchenStatus(row.status)) return [];
    return [
      {
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        ...fulfillmentOf(row),
        notes: row.notes,
        totalCents: row.totalCents,
        lines: lines.get(row.id) ?? [],
      },
    ];
  });

  return { facilityName: facility[0]?.name ?? "Cocina", orders, counts };
}

/** The printed ticket for one order, as published to the kitchen queue. */
export async function getKitchenTicket(orderId: string): Promise<KitchenTicket | null> {
  const [row] = await getDb()
    .select({
      ...orderColumns,
      kitchenFacilityId: schema.orders.kitchenFacilityId,
      facilityName: schema.kitchenFacilities.name,
      paidAt: schema.orders.paidAt,
      paymentMethod: schema.payments.provider,
    })
    .from(schema.orders)
    .leftJoin(schema.deliveryZones, eq(schema.deliveryZones.id, schema.orders.deliveryZoneId))
    .leftJoin(schema.pickupPoints, eq(schema.pickupPoints.id, schema.orders.pickupPointId))
    .innerJoin(schema.kitchenFacilities, eq(schema.kitchenFacilities.id, schema.orders.kitchenFacilityId))
    .leftJoin(schema.payments, eq(schema.payments.orderId, schema.orders.id))
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!row) return null;

  const lines = await loadLines([row.id]);
  return {
    v: 1,
    orderId: row.id,
    orderNumber: row.orderNumber,
    kitchenFacilityId: row.kitchenFacilityId,
    facilityName: row.facilityName,
    paymentMethod: row.paymentMethod ?? "openpay",
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    ...fulfillmentOf(row),
    notes: row.notes,
    totalCents: row.totalCents,
    lines: lines.get(row.id) ?? [],
  };
}
