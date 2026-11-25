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

/**
 * Reorders plates so neighbours never share a protein and, where possible, not a base either. Proteins take
 * turns (the one shown longest ago goes next), unless that would leave the biggest group with no room to
 * spread out. Deterministic, so the server and browser render the same order.
 */
export function mixPlates<T extends { protein: string; base: string }>(plates: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const plate of plates) groups.set(plate.protein, [...(groups.get(plate.protein) ?? []), plate]);
  const order = [...groups.keys()];
  const lastUsed = new Map(order.map((protein) => [protein, -1]));

  // Can the plates left be laid out with no protein twice in a row, given the one just placed?
  const feasible = (placed: string) => {
    let total = 0;
    let most = 0;
    let owner = "";
    for (const [protein, left] of groups) {
      total += left.length;
      if (left.length > most) [most, owner] = [left.length, protein];
    }
    return owner === placed ? most <= Math.floor(total / 2) : most <= Math.ceil(total / 2);
  };

  const mixed: T[] = [];
  while (mixed.length < plates.length) {
    const prev = mixed.at(-1);
    const turns = order
      .filter((protein) => groups.get(protein)!.length && protein !== prev?.protein)
      .sort((a, b) => lastUsed.get(a)! - lastUsed.get(b)!);

    let choice: { protein: string; index: number } | undefined;
    let fallback: { protein: string; index: number } | undefined;
    for (const protein of turns) {
      const left = groups.get(protein)!;
      const index = Math.max(0, left.findIndex((p) => p.base !== prev?.base));
      const [plate] = left.splice(index, 1);
      const ok = feasible(protein);
      left.splice(index, 0, plate);
      if (!ok) continue;
      fallback ??= { protein, index };
      if (plate.base !== prev?.base) {
        choice = { protein, index };
        break;
      }
    }
    // No arrangement avoids a repeat (one protein outnumbers the rest): take whatever is left.
    const pick = choice ?? fallback ?? { protein: order.find((p) => groups.get(p)!.length)!, index: 0 };
    mixed.push(groups.get(pick.protein)!.splice(pick.index, 1)[0]);
    lastUsed.set(pick.protein, mixed.length);
  }
  return mixed;
}

/** Menu cards for the home row, mixed by protein and base. */
export function mixedMenuCards(catalog: Catalog): MenuCard[] {
  return menuCards({ ...catalog, templates: mixPlates(catalog.templates) });
}
