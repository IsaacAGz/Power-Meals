import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  "ordered_whatsapp",
  "paid",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

export const fulfillmentType = pgEnum("fulfillment_type", ["delivery", "pickup"]);

export const paymentStatus = pgEnum("payment_status", ["pending", "succeeded", "failed", "refunded"]);

export const portionSize = pgEnum("portion_size", ["regular", "plus"]);

export const plateStyle = pgEnum("plate_style", ["balanced", "double_carb"]);

export const proteinTier = pgEnum("protein_tier", ["base", "premium"]);

export const cartLineSource = pgEnum("cart_line_source", ["builder", "template", "reorder", "package"]);

export const orderLineKind = pgEnum("order_line_kind", ["meal", "package", "package_slot"]);

export const kitchenFacilities = pgTable("kitchen_facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const catalogFilters = pgTable("catalog_filters", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const proteins = pgTable(
  "proteins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tier: proteinTier("tier").notNull(),
    // Added to the portion size's base price.
    regularUpgradeCents: integer("regular_upgrade_cents").notNull().default(0),
    plusUpgradeCents: integer("plus_upgrade_cents").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check("proteins_upgrade_non_negative", sql`${table.regularUpgradeCents} >= 0 AND ${table.plusUpgradeCents} >= 0`),
  ],
);

export const carbBases = pgTable("carb_bases", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // Ensalada has no carb portion, so it can't be doubled.
  hasCarbPortion: boolean("has_carb_portion").notNull().default(true),
  includesVeggies: boolean("includes_veggies").notNull().default(true),
  allowsDoubleCarb: boolean("allows_double_carb").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const portionSizes = pgTable(
  "portion_sizes",
  {
    size: portionSize("size").primaryKey(),
    label: text("label").notNull(),
    basePriceCents: integer("base_price_cents").notNull(),
    proteinGrams: integer("protein_grams").notNull(),
    carbGrams: integer("carb_grams").notNull(),
    vegGrams: integer("veg_grams").notNull(),
    doubleCarbGrams: integer("double_carb_grams").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [check("portion_sizes_price_positive", sql`${table.basePriceCents} > 0`)],
);

export const mealTemplates = pgTable(
  "meal_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    proteinId: uuid("protein_id")
      .notNull()
      .references(() => proteins.id),
    carbBaseId: uuid("carb_base_id")
      .notNull()
      .references(() => carbBases.id),
    imageUrl: text("image_url").notNull(),
    skuRegular: text("sku_regular"),
    skuPlus: text("sku_plus"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("meal_templates_composition_idx").on(table.proteinId, table.carbBaseId)],
);

export const mealTemplateFilters = pgTable(
  "meal_template_filters",
  {
    templateId: uuid("template_id")
      .notNull()
      .references(() => mealTemplates.id, { onDelete: "cascade" }),
    filterId: uuid("filter_id")
      .notNull()
      .references(() => catalogFilters.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.templateId, table.filterId] })],
);

export type MealPackageRules = {
  /** When set, every slot must use one of these protein slugs. */
  proteinSlugs?: string[];
  /** Premium proteins add their per-meal upgrade to the package price. */
  premiumSurcharge: boolean;
};

export const mealPackages = pgTable(
  "meal_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    productSlug: text("product_slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    mealCount: integer("meal_count").notNull(),
    size: portionSize("size").notNull(),
    priceCents: integer("price_cents").notNull(),
    rules: jsonb("rules").$type<MealPackageRules>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("meal_packages_variant_idx").on(table.productSlug, table.mealCount, table.size),
    check("meal_packages_price_positive", sql`${table.priceCents} > 0`),
    check("meal_packages_meal_count_range", sql`${table.mealCount} BETWEEN 1 AND 30`),
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
    // Null until the person opens the confirmation link. Existing rows are backfilled so they can still sign in.
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
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
    // Bearer token for the sessionless Openpay return pages; also sent to Openpay as the charge order_id.
    publicOrderRef: text("public_order_ref").notNull().unique(),
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

/**
 * Frozen at order time. Package bundles are one "package" row (carries the price) plus one
 * "package_slot" row per meal (price 0) pointing at it through parent_line_id.
 */
export const orderLineItems = pgTable(
  "order_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    parentLineId: uuid("parent_line_id").references((): AnyPgColumn => orderLineItems.id, { onDelete: "cascade" }),
    kind: orderLineKind("kind").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    quantity: integer("quantity").notNull(),
    displayName: text("display_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    proteinId: uuid("protein_id").references(() => proteins.id),
    carbBaseId: uuid("carb_base_id").references(() => carbBases.id),
    portionSize: portionSize("portion_size"),
    plateStyle: plateStyle("plate_style"),
    proteinGrams: integer("protein_grams"),
    carbGrams: integer("carb_grams"),
    vegGrams: integer("veg_grams"),
    salsaNote: text("salsa_note"),
    templateId: uuid("template_id").references(() => mealTemplates.id),
    packageId: uuid("package_id").references(() => mealPackages.id),
    // Cart item as ordered (top-level lines only), so "Pedir de nuevo" can clone it.
    item: jsonb("item"),
  },
  (table) => [
    index("order_line_items_order_idx").on(table.orderId),
    check("order_line_items_quantity_range", sql`${table.quantity} BETWEEN 1 AND 20`),
    check("order_line_items_price_non_negative", sql`${table.unitPriceCents} >= 0 AND ${table.lineTotalCents} >= 0`),
    check(
      "order_line_items_slot_has_parent",
      sql`(${table.kind} = 'package_slot') = (${table.parentLineId} IS NOT NULL)`,
    ),
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
    // paid | failed change the order; duplicate | ignored | unknown_order | amount_mismatch don't.
    outcome: text("outcome"),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("openpay_webhook_events_event_idx").on(table.openpayEventId),
    index("openpay_webhook_events_order_idx").on(table.orderId),
    // Only one event per transaction and type may change an order; everything else is audit only.
    uniqueIndex("openpay_webhook_events_applied_once_idx")
      .on(table.openpayTransactionId, table.eventType)
      .where(sql`${table.outcome} IN ('paid', 'failed')`),
  ],
);

/**
 * Outbox for kitchen tickets. Written in the same transaction as the first transition to paid, so a ticket
 * cannot be lost between the commit and the SQS send; one row per order keeps replays from printing twice.
 */
export const kitchenDispatches = pgTable(
  "kitchen_dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    kitchenFacilityId: uuid("kitchen_facility_id")
      .notNull()
      .references(() => kitchenFacilities.id),
    // pending -> sent; failed after too many attempts; skipped when SQS is not configured.
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sqsMessageId: text("sqs_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("kitchen_dispatches_pending_idx").on(table.createdAt).where(sql`${table.status} = 'pending'`),
    check("kitchen_dispatches_status", sql`${table.status} IN ('pending', 'sent', 'failed', 'skipped')`),
  ],
);

/**
 * One message per order, written in the same transaction as the first transition to paid.
 * Later kitchen steps do not insert a row. WhatsApp stays skipped until that sender exists.
 */
export const orderNotifications = pgTable(
  "order_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    destination: text("destination").notNull(),
    // pending -> sent; failed after too many attempts; skipped when the channel is not configured.
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("order_notifications_pending_idx").on(table.createdAt).where(sql`${table.status} = 'pending'`),
    check("order_notifications_channel", sql`${table.channel} IN ('email', 'whatsapp')`),
    check("order_notifications_status", sql`${table.status} IN ('pending', 'sent', 'failed', 'skipped')`),
  ],
);

/** Logged-in working cart. Same item shape as the guest Redis cart; prices are re-resolved at checkout. */
export const cartLineItems = pgTable(
  "cart_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lineKey: text("line_key").notNull(),
    source: cartLineSource("source").notNull(),
    item: jsonb("item").notNull(),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cart_line_items_user_line_idx").on(table.userId, table.lineKey),
    check("cart_line_items_quantity_range", sql`${table.quantity} BETWEEN 1 AND 20`),
  ],
);
