import { baseSeed, filterSeed, packageSeed, portionSeed, proteinSeed, templateSeed } from "@/lib/catalog/seed-data";
import type { Catalog, CartItem, MealSelection, PackageSlot } from "@/lib/catalog/types";

/** The seeded catalog with fake ids, so unit tests price against the same numbers the database holds. */
export function seedCatalog(): Catalog {
  return {
    proteins: proteinSeed.map((row) => ({
      id: `protein-${row.slug}`,
      slug: row.slug,
      name: row.name,
      tier: row.tier,
      upgradeCents: { regular: row.regularUpgradeCents, plus: row.plusUpgradeCents },
    })),
    bases: baseSeed.map((row) => ({ id: `base-${row.slug}`, ...row })),
    portions: portionSeed.map((row) => ({ ...row })),
    filters: filterSeed.map((row) => ({ ...row })),
    templates: templateSeed.map((row) => ({
      id: `template-${row.slug}`,
      slug: row.slug,
      name: row.name,
      description: row.description,
      protein: row.protein,
      base: row.base,
      imageUrl: row.imageUrl,
      filters: [...row.filters],
    })),
    packages: packageSeed.map((row) => ({ id: `package-${row.slug}`, ...row })),
  };
}

export function meal(selection: Partial<MealSelection> = {}): Extract<CartItem, { kind: "meal" }> {
  return {
    kind: "meal",
    source: "builder",
    meal: { protein: "pollo", base: "arroz", size: "regular", style: "balanced", salsa: "roja", ...selection },
  };
}

export function slots(count: number, slot: Partial<PackageSlot> = {}): PackageSlot[] {
  return Array.from({ length: count }, () => ({
    protein: "pollo",
    base: "arroz",
    style: "balanced" as const,
    salsa: "roja" as const,
    ...slot,
  }));
}
