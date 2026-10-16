import "server-only";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import type { Catalog } from "./types";

/** Active catalog for one request. Inactive rows drop out, so cart lines that use them stop resolving. */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const db = getDb();
  const [proteins, bases, portions, filters, templates, templateFilters, packages] = await Promise.all([
    db.select().from(schema.proteins).where(eq(schema.proteins.isActive, true)).orderBy(asc(schema.proteins.sortOrder)),
    db.select().from(schema.carbBases).where(eq(schema.carbBases.isActive, true)).orderBy(asc(schema.carbBases.sortOrder)),
    db.select().from(schema.portionSizes).orderBy(asc(schema.portionSizes.sortOrder)),
    db.select().from(schema.catalogFilters).orderBy(asc(schema.catalogFilters.sortOrder)),
    db
      .select({
        id: schema.mealTemplates.id,
        slug: schema.mealTemplates.slug,
        name: schema.mealTemplates.name,
        description: schema.mealTemplates.description,
        imageUrl: schema.mealTemplates.imageUrl,
        protein: schema.proteins.slug,
        base: schema.carbBases.slug,
      })
      .from(schema.mealTemplates)
      .innerJoin(schema.proteins, eq(schema.proteins.id, schema.mealTemplates.proteinId))
      .innerJoin(schema.carbBases, eq(schema.carbBases.id, schema.mealTemplates.carbBaseId))
      .where(eq(schema.mealTemplates.isActive, true))
      .orderBy(asc(schema.mealTemplates.sortOrder)),
    db
      .select({ templateId: schema.mealTemplateFilters.templateId, filter: schema.catalogFilters.slug })
      .from(schema.mealTemplateFilters)
      .innerJoin(schema.catalogFilters, eq(schema.catalogFilters.id, schema.mealTemplateFilters.filterId)),
    db.select().from(schema.mealPackages).where(eq(schema.mealPackages.isActive, true)).orderBy(asc(schema.mealPackages.sortOrder)),
  ]);

  const activeProteins = new Set(proteins.map((row) => row.slug));
  const activeBases = new Set(bases.map((row) => row.slug));

  return {
    proteins: proteins.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      tier: row.tier,
      upgradeCents: { regular: row.regularUpgradeCents, plus: row.plusUpgradeCents },
    })),
    bases: bases.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      hasCarbPortion: row.hasCarbPortion,
      includesVeggies: row.includesVeggies,
      allowsDoubleCarb: row.allowsDoubleCarb,
    })),
    portions: portions.map((row) => ({
      size: row.size,
      label: row.label,
      basePriceCents: row.basePriceCents,
      proteinGrams: row.proteinGrams,
      carbGrams: row.carbGrams,
      vegGrams: row.vegGrams,
      doubleCarbGrams: row.doubleCarbGrams,
    })),
    filters: filters.map((row) => ({ slug: row.slug, label: row.label })),
    templates: templates
      .filter((row) => activeProteins.has(row.protein) && activeBases.has(row.base))
      .map((row) => ({
        ...row,
        filters: templateFilters.filter((link) => link.templateId === row.id).map((link) => link.filter),
      })),
    packages: packages.map((row) => ({
      id: row.id,
      slug: row.slug,
      productSlug: row.productSlug,
      name: row.name,
      description: row.description,
      mealCount: row.mealCount,
      size: row.size,
      priceCents: row.priceCents,
      rules: row.rules,
    })),
  };
});
