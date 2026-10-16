import type { MenuCard } from "@/components/MenuBrowser";
import { resolveMeal } from "./pricing";
import type { Catalog } from "./types";

export function menuCards(catalog: Catalog): MenuCard[] {
  return catalog.templates.flatMap((template) => {
    const meal = { protein: template.protein, base: template.base, style: "balanced", salsa: "roja" } as const;
    const regular = resolveMeal(catalog, { ...meal, size: "regular" });
    const plus = resolveMeal(catalog, { ...meal, size: "plus" });
    if (!regular || !plus) return [];
    return [
      {
        slug: template.slug,
        name: template.name,
        description: template.description,
        imageUrl: template.imageUrl,
        filters: template.filters,
        regularCents: regular.unitPriceCents,
        plusCents: plus.unitPriceCents,
      },
    ];
  });
}
