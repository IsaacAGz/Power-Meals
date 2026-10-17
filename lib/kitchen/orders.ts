import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { styleLabels, type PlateStyle } from "@/lib/catalog/types";
import { getDb, schema } from "@/lib/db";
import { emptyKitchenCounts, KITCHEN_STATUSES, type KitchenBoard, type KitchenOrder, type KitchenStatus } from "./types";

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
    db
      .select(orderColumns)
      .from(schema.orders)
      .leftJoin(schema.deliveryZones, eq(schema.deliveryZones.id, schema.orders.deliveryZoneId))
      .leftJoin(schema.pickupPoints, eq(schema.pickupPoints.id, schema.orders.pickupPointId))
      .where(and(facilityFilter, inArray(schema.orders.status, ACTIVE)))
      .orderBy(asc(schema.orders.createdAt)),
    db
      .select(orderColumns)
      .from(schema.orders)
      .leftJoin(schema.deliveryZones, eq(schema.deliveryZones.id, schema.orders.deliveryZoneId))
      .leftJoin(schema.pickupPoints, eq(schema.pickupPoints.id, schema.orders.pickupPointId))
      .where(and(facilityFilter, eq(schema.orders.status, "completed")))
      .orderBy(desc(schema.orders.createdAt))
      .limit(COMPLETED_LIMIT),
  ]);

  const rows = [...active, ...completed];
  const lineRows = rows.length
    ? await db
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
        .where(inArray(schema.orderLineItems.orderId, rows.map((row) => row.id)))
        .orderBy(asc(schema.orderLineItems.sortOrder))
    : [];

  const counts = emptyKitchenCounts();
  for (const row of countRows) {
    if (isKitchenStatus(row.status)) counts[row.status] = row.value;
  }

  const orders: KitchenOrder[] = rows.flatMap((row) => {
    if (!isKitchenStatus(row.status)) return [];
    const own = lineRows.filter((line) => line.orderId === row.id);
    const delivery = row.fulfillmentType === "delivery";
    return [
      {
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        fulfillment: row.fulfillmentType,
        place: (delivery ? row.zoneName : row.pointName) ?? "",
        address: delivery ? row.deliveryAddress : row.pointAddress,
        notes: row.notes,
        totalCents: row.totalCents,
        lines: own
          .filter((line) => !line.parentLineId)
          .map((line) => ({
            name: line.displayName,
            quantity: line.quantity,
            detail: detailOf(line),
            slots: own
              .filter((slot) => slot.parentLineId === line.id)
              .map((slot) => ({ name: slot.displayName, detail: detailOf(slot) })),
          })),
      },
    ];
  });

  return { facilityName: facility[0]?.name ?? "Cocina", orders, counts };
}
