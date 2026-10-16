import { inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { baseSeed, filterSeed, packageSeed, portionSeed, proteinSeed, templateSeed } from "../catalog/seed-data";
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

    const catalog = await seedCatalog(tx);

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
      ...catalog,
      deliveryZones: zoneRows.length,
      pickupPoints: pickupRows.length,
    };
  });
}

type SeedTx = Parameters<Parameters<SeedDatabase["transaction"]>[0]>[0];

const withOrder = <T>(rows: readonly T[]) => rows.map((row, index) => ({ ...row, sortOrder: index }));

async function seedCatalog(tx: SeedTx) {
  const filterRows = await tx
    .insert(schema.catalogFilters)
    .values(withOrder(filterSeed))
    .onConflictDoUpdate({
      target: schema.catalogFilters.slug,
      set: { label: sql`excluded.label`, sortOrder: sql`excluded.sort_order` },
    })
    .returning({ id: schema.catalogFilters.id, slug: schema.catalogFilters.slug });
  const filterId = new Map(filterRows.map((row) => [row.slug, row.id]));

  await tx
    .insert(schema.portionSizes)
    .values(withOrder(portionSeed))
    .onConflictDoUpdate({
      target: schema.portionSizes.size,
      set: {
        label: sql`excluded.label`,
        basePriceCents: sql`excluded.base_price_cents`,
        proteinGrams: sql`excluded.protein_grams`,
        carbGrams: sql`excluded.carb_grams`,
        vegGrams: sql`excluded.veg_grams`,
        doubleCarbGrams: sql`excluded.double_carb_grams`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  const proteinRows = await tx
    .insert(schema.proteins)
    .values(withOrder(proteinSeed))
    .onConflictDoUpdate({
      target: schema.proteins.slug,
      set: {
        name: sql`excluded.name`,
        tier: sql`excluded.tier`,
        regularUpgradeCents: sql`excluded.regular_upgrade_cents`,
        plusUpgradeCents: sql`excluded.plus_upgrade_cents`,
        sortOrder: sql`excluded.sort_order`,
      },
    })
    .returning({ id: schema.proteins.id, slug: schema.proteins.slug });
  const proteinId = new Map(proteinRows.map((row) => [row.slug, row.id]));

  const baseRows = await tx
    .insert(schema.carbBases)
    .values(withOrder(baseSeed))
    .onConflictDoUpdate({
      target: schema.carbBases.slug,
      set: {
        name: sql`excluded.name`,
        hasCarbPortion: sql`excluded.has_carb_portion`,
        includesVeggies: sql`excluded.includes_veggies`,
        allowsDoubleCarb: sql`excluded.allows_double_carb`,
        sortOrder: sql`excluded.sort_order`,
      },
    })
    .returning({ id: schema.carbBases.id, slug: schema.carbBases.slug });
  const baseId = new Map(baseRows.map((row) => [row.slug, row.id]));

  const templateRows = await tx
    .insert(schema.mealTemplates)
    .values(
      templateSeed.map((template, index) => ({
        slug: template.slug,
        name: template.name,
        description: template.description,
        proteinId: proteinId.get(template.protein)!,
        carbBaseId: baseId.get(template.base)!,
        imageUrl: template.imageUrl,
        skuRegular: template.skuRegular,
        skuPlus: template.skuPlus,
        sortOrder: index,
      })),
    )
    .onConflictDoUpdate({
      target: schema.mealTemplates.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        proteinId: sql`excluded.protein_id`,
        carbBaseId: sql`excluded.carb_base_id`,
        imageUrl: sql`excluded.image_url`,
        skuRegular: sql`excluded.sku_regular`,
        skuPlus: sql`excluded.sku_plus`,
        sortOrder: sql`excluded.sort_order`,
      },
    })
    .returning({ id: schema.mealTemplates.id, slug: schema.mealTemplates.slug });
  const templateId = new Map(templateRows.map((row) => [row.slug, row.id]));

  await tx.delete(schema.mealTemplateFilters).where(inArray(schema.mealTemplateFilters.templateId, [...templateId.values()]));
  const links = templateSeed.flatMap((template) =>
    template.filters.map((filter) => ({ templateId: templateId.get(template.slug)!, filterId: filterId.get(filter)! })),
  );
  if (links.length > 0) await tx.insert(schema.mealTemplateFilters).values(links);

  const packageRows = await tx
    .insert(schema.mealPackages)
    .values(withOrder(packageSeed))
    .onConflictDoUpdate({
      target: schema.mealPackages.slug,
      set: {
        productSlug: sql`excluded.product_slug`,
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        mealCount: sql`excluded.meal_count`,
        size: sql`excluded.size`,
        priceCents: sql`excluded.price_cents`,
        rules: sql`excluded.rules`,
        sortOrder: sql`excluded.sort_order`,
      },
    })
    .returning({ id: schema.mealPackages.id });

  return {
    catalogFilters: filterRows.length,
    proteins: proteinRows.length,
    carbBases: baseRows.length,
    mealTemplates: templateRows.length,
    mealPackages: packageRows.length,
  };
}
