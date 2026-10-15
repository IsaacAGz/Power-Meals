import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const userRole = pgEnum("user_role", ["customer", "kitchen_staff", "admin"]);

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

export const fulfillmentType = pgEnum("fulfillment_type", ["delivery", "pickup"]);

export const paymentStatus = pgEnum("payment_status", ["pending", "succeeded", "failed", "refunded"]);

export const kitchenFacilities = pgTable("kitchen_facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const dishes = pgTable(
  "dishes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    priceCents: integer("price_cents").notNull(),
    imageUrl: text("image_url").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("dishes_category_idx").on(table.categoryId),
    check("dishes_price_positive", sql`${table.priceCents} > 0`),
  ],
);

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    deliveryDaysLabel: text("delivery_days_label").notNull(),
    // ISO weekdays: 1 = Monday ... 7 = Sunday
    deliveryWeekdays: smallint("delivery_weekdays").array().notNull(),
    kitchenFacilityId: uuid("kitchen_facility_id")
      .notNull()
      .references(() => kitchenFacilities.id),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("delivery_zones_facility_idx").on(table.kitchenFacilityId)],
);

export const pickupPoints = pgTable(
  "pickup_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    hoursLabel: text("hours_label").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    kitchenFacilityId: uuid("kitchen_facility_id")
      .notNull()
      .references(() => kitchenFacilities.id),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("pickup_points_facility_idx").on(table.kitchenFacilityId)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    // PHC-format Argon2id string; embeds the per-user salt. The pepper never touches the database.
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("customer"),
    kitchenFacilityId: uuid("kitchen_facility_id").references(() => kitchenFacilities.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`),
    check(
      "users_staff_has_facility",
      sql`${table.role} <> 'kitchen_staff' OR ${table.kitchenFacilityId} IS NOT NULL`,
    ),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: serial("order_number").notNull().unique(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    status: orderStatus("status").notNull().default("pending_payment"),
    fulfillmentType: fulfillmentType("fulfillment_type").notNull(),
    deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZones.id),
    deliveryAddress: text("delivery_address"),
    pickupPointId: uuid("pickup_point_id").references(() => pickupPoints.id),
    kitchenFacilityId: uuid("kitchen_facility_id")
      .notNull()
      .references(() => kitchenFacilities.id),
    subtotalCents: integer("subtotal_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    notes: text("notes"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("orders_facility_status_idx").on(table.kitchenFacilityId, table.status),
    index("orders_user_idx").on(table.userId),
    check(
      "orders_fulfillment_target",
      sql`(${table.fulfillmentType} = 'delivery' AND ${table.deliveryZoneId} IS NOT NULL AND ${table.deliveryAddress} IS NOT NULL AND ${table.pickupPointId} IS NULL)
        OR (${table.fulfillmentType} = 'pickup' AND ${table.pickupPointId} IS NOT NULL AND ${table.deliveryZoneId} IS NULL)`,
    ),
    check("orders_total_positive", sql`${table.totalCents} > 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id),
    dishName: text("dish_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    check("order_items_quantity_range", sql`${table.quantity} BETWEEN 1 AND 20`),
  ],
);

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_status_events_order_idx").on(table.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    provider: text("provider").notNull().default("openpay"),
    openpayChargeId: text("openpay_charge_id").unique(),
    status: paymentStatus("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("MXN"),
    ...timestamps,
  },
  (table) => [index("payments_order_idx").on(table.orderId)],
);

export const openpayWebhookEvents = pgTable(
  "openpay_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    openpayEventId: text("openpay_event_id"),
    openpayTransactionId: text("openpay_transaction_id"),
    orderId: uuid("order_id").references(() => orders.id),
    eventType: text("event_type").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("openpay_webhook_events_event_idx").on(table.openpayEventId),
    index("openpay_webhook_events_order_idx").on(table.orderId),
    // Replays are logged as duplicates; only one non-duplicate row may exist per transaction and event type.
    uniqueIndex("openpay_webhook_events_processed_once_idx")
      .on(table.openpayTransactionId, table.eventType)
      .where(sql`${table.isDuplicate} = false`),
  ],
);

export const cartLines = pgTable(
  "cart_lines",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.dishId] }),
    check("cart_lines_quantity_range", sql`${table.quantity} BETWEEN 1 AND 20`),
  ],
);
