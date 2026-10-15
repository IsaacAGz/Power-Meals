import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { categories as staticCategories, dishes as staticDishes } from "../menu-data";
import { pickupPoints as staticPickupPoints, zones as staticZones } from "../locations-data";
import * as schema from "./schema";

type SeedDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export const kitchenFacilitySeed = [
  { slug: "zona-rio", name: "Zona Río", latitude: 32.52820512415235, longitude: -117.01893541543576 },
  { slug: "otay", name: "Otay", latitude: 32.53809645350098, longitude: -116.92983513766147 },
  { slug: "plaza-monarca", name: "Plaza Monarca", latitude: 32.500821014237935, longitude: -116.92067276725912 },
  {
    slug: "rio-tijuana-3ra-etapa",
    name: "Rio Tijuana 3ra Etapa",
    latitude: 32.497178312977205,
    longitude: -116.93127319919203,
  },
] as const;

type FacilitySlug = (typeof kitchenFacilitySeed)[number]["slug"];

// Initial routing only; ops can reassign rows in the database without a deploy.
const zoneFacility: Record<string, FacilitySlug> = {
  "zona-rio": "zona-rio",
  chapultepec: "zona-rio",
  hipodromo: "zona-rio",
  otay: "otay",
  playas: "zona-rio",
};

const pickupPointFacility: Record<string, FacilitySlug> = {
  "recoleccion-zona-rio": "zona-rio",
  "recoleccion-playas": "zona-rio",
};

const weekdayByName: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  domingo: 7,
};

export function parseWeekdays(label: string): number[] {
  const days = label
    .toLowerCase()
    .split(/,\s*|\s+y\s+/)
    .map((word) => weekdayByName[word.trim()]);
  if (days.length === 0 || days.some((day) => day === undefined)) {
    throw new Error(`Cannot parse delivery days from "${label}"`);
  }
  return days;
}

function facilityFor(map: Record<string, FacilitySlug>, slug: string, kind: string): FacilitySlug {
  const facility = map[slug];
  if (!facility) throw new Error(`No kitchen facility mapped for ${kind} "${slug}"`);
  return facility;
}

export async function seed(db: SeedDatabase) {
  return db.transaction(async (tx) => {
    const facilities = await tx
      .insert(schema.kitchenFacilities)
      .values([...kitchenFacilitySeed])
      .onConflictDoUpdate({
        target: schema.kitchenFacilities.slug,
        set: {
          name: sql`excluded.name`,
          latitude: sql`excluded.latitude`,
          longitude: sql`excluded.longitude`,
        },
      })
      .returning({ id: schema.kitchenFacilities.id, slug: schema.kitchenFacilities.slug });
    const facilityId = new Map(facilities.map((row) => [row.slug, row.id]));

    const categoryRows = await tx
      .insert(schema.categories)
      .values(staticCategories.map((category, index) => ({ slug: category.id, label: category.label, sortOrder: index })))
      .onConflictDoUpdate({
        target: schema.categories.slug,
        set: { label: sql`excluded.label`, sortOrder: sql`excluded.sort_order` },
      })
      .returning({ id: schema.categories.id, slug: schema.categories.slug });
    const categoryId = new Map(categoryRows.map((row) => [row.slug, row.id]));

    const dishRows = await tx
      .insert(schema.dishes)
      .values(
        staticDishes.map((dish, index) => ({
          slug: dish.slug,
          categoryId: categoryId.get(dish.category)!,
          name: dish.name,
          description: dish.description,
          priceCents: Math.round(dish.price * 100),
          imageUrl: dish.image,
          sortOrder: index,
        })),
      )
      .onConflictDoUpdate({
        target: schema.dishes.slug,
        set: {
          categoryId: sql`excluded.category_id`,
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          priceCents: sql`excluded.price_cents`,
          imageUrl: sql`excluded.image_url`,
          sortOrder: sql`excluded.sort_order`,
        },
      })
      .returning({ id: schema.dishes.id });

    const zoneRows = await tx
      .insert(schema.deliveryZones)
      .values(
        staticZones.map((zone) => ({
          slug: zone.slug,
          name: zone.name,
          deliveryDaysLabel: zone.days,
          deliveryWeekdays: parseWeekdays(zone.days),
          kitchenFacilityId: facilityId.get(facilityFor(zoneFacility, zone.slug, "zone"))!,
        })),
      )
      .onConflictDoUpdate({
        target: schema.deliveryZones.slug,
        set: {
          name: sql`excluded.name`,
          deliveryDaysLabel: sql`excluded.delivery_days_label`,
          deliveryWeekdays: sql`excluded.delivery_weekdays`,
        },
      })
      .returning({ id: schema.deliveryZones.id });

    const pickupRows = await tx
      .insert(schema.pickupPoints)
      .values(
        staticPickupPoints.map((point) => ({
          slug: point.slug,
          name: point.name,
          address: point.address,
          hoursLabel: point.hours,
          longitude: point.coordinates[0],
          latitude: point.coordinates[1],
          kitchenFacilityId: facilityId.get(facilityFor(pickupPointFacility, point.slug, "pickup point"))!,
        })),
      )
      .onConflictDoUpdate({
        target: schema.pickupPoints.slug,
        set: {
          name: sql`excluded.name`,
          address: sql`excluded.address`,
          hoursLabel: sql`excluded.hours_label`,
          latitude: sql`excluded.latitude`,
          longitude: sql`excluded.longitude`,
        },
      })
      .returning({ id: schema.pickupPoints.id });

    return {
      kitchenFacilities: facilities.length,
      categories: categoryRows.length,
      dishes: dishRows.length,
      deliveryZones: zoneRows.length,
      pickupPoints: pickupRows.length,
    };
  });
}
