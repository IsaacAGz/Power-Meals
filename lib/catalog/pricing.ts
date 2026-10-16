// Pure pricing and naming rules (Sistema Maestro V1). Runs on the client for previews; the server
// re-runs it from the database catalog at checkout and never trusts client totals.
import {
  PLATE_STYLES,
  PORTION_SIZES,
  SALSAS,
  portionLabels,
  salsaLabels,
  styleLabels,
  type CarbBase,
  type CartItem,
  type Catalog,
  type MealPackage,
  type MealSelection,
  type MealTemplate,
  type PackageSlot,
  type PlateStyle,
  type Portion,
  type Protein,
  type Salsa,
} from "./types";

export const MAX_LINE_QUANTITY = 20;
export const MAX_CART_LINES = 30;
const MAX_PACKAGE_SLOTS = 30;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ResolvedMeal = {
  protein: Protein;
  base: CarbBase;
  portion: Portion;
  style: PlateStyle;
  salsa: Salsa;
  template?: MealTemplate;
  name: string;
  upgradeCents: number;
  unitPriceCents: number;
  proteinGrams: number;
  carbGrams: number;
  vegGrams: number;
  salsaNote: string;
};

export type ResolvedLine = {
  key: string;
  item: CartItem;
  quantity: number;
  displayName: string;
  detail: string;
  unitPriceCents: number;
  lineTotalCents: number;
  meals: ResolvedMeal[];
  package?: MealPackage;
};

const lower = (value: string) => value.toLocaleLowerCase("es-MX");

export function mealName(protein: Protein, base: CarbBase, style: PlateStyle, template?: MealTemplate): string {
  if (!base.hasCarbPortion) return `${base.name} con ${lower(protein.name)}`;
  if (style === "double_carb") return `${protein.name} + doble ${lower(base.name)}`;
  if (template) return template.name;
  return `${protein.name} + ${lower(base.name)}${base.includesVeggies ? " + veggies" : ""}`;
}

export function findTemplateFor(catalog: Catalog, protein: string, base: string) {
  return catalog.templates.find((template) => template.protein === protein && template.base === base);
}

export function resolveMeal(catalog: Catalog, selection: MealSelection): ResolvedMeal | null {
  const protein = catalog.proteins.find((row) => row.slug === selection.protein);
  const base = catalog.bases.find((row) => row.slug === selection.base);
  const portion = catalog.portions.find((row) => row.size === selection.size);
  if (!protein || !base || !portion) return null;
  if (selection.style === "double_carb" && !base.allowsDoubleCarb) return null;

  const template = findTemplateFor(catalog, protein.slug, base.slug);
  const upgradeCents = protein.upgradeCents[portion.size];
  const doubled = selection.style === "double_carb";
  return {
    protein,
    base,
    portion,
    style: selection.style,
    salsa: selection.salsa,
    template,
    name: mealName(protein, base, selection.style, template),
    upgradeCents,
    unitPriceCents: portion.basePriceCents + upgradeCents,
    proteinGrams: portion.proteinGrams,
    carbGrams: base.hasCarbPortion ? (doubled ? portion.doubleCarbGrams : portion.carbGrams) : 0,
    vegGrams: !doubled && base.includesVeggies ? portion.vegGrams : 0,
    salsaNote: `${salsaLabels[selection.salsa]} 1 oz`,
  };
}

export function resolvePackage(catalog: Catalog, slug: string, slots: PackageSlot[]) {
  const pkg = catalog.packages.find((row) => row.slug === slug);
  if (!pkg || slots.length !== pkg.mealCount) return null;

  const meals: ResolvedMeal[] = [];
  for (const slot of slots) {
    if (pkg.rules.proteinSlugs && !pkg.rules.proteinSlugs.includes(slot.protein)) return null;
    const meal = resolveMeal(catalog, { ...slot, size: pkg.size });
    if (!meal) return null;
    meals.push(meal);
  }
  const surchargeCents = pkg.rules.premiumSurcharge ? meals.reduce((sum, meal) => sum + meal.upgradeCents, 0) : 0;
  return { pkg, meals, surchargeCents, unitPriceCents: pkg.priceCents + surchargeCents };
}

export function packageTitle(pkg: MealPackage) {
  return `${pkg.name} · ${pkg.mealCount} comidas ${portionLabels[pkg.size]}`;
}

export function mealDetail(meal: ResolvedMeal) {
  const style = meal.base.hasCarbPortion ? `${styleLabels[meal.style]} · ` : "";
  return `${style}${salsaLabels[meal.salsa]} · ${meal.proteinGrams} g proteína`;
}

export function resolveLine(catalog: Catalog, item: CartItem, quantity: number): ResolvedLine | null {
  if (item.kind === "meal") {
    const meal = resolveMeal(catalog, item.meal);
    if (!meal) return null;
    return {
      key: lineKey(item),
      item,
      quantity,
      displayName: `${meal.name} · ${meal.portion.label}`,
      detail: mealDetail(meal),
      unitPriceCents: meal.unitPriceCents,
      lineTotalCents: meal.unitPriceCents * quantity,
      meals: [meal],
    };
  }

  const resolved = resolvePackage(catalog, item.package, item.slots);
  if (!resolved) return null;
  const premium = resolved.surchargeCents > 0 ? " · incluye proteínas premium" : "";
  return {
    key: lineKey(item),
    item,
    quantity,
    displayName: packageTitle(resolved.pkg),
    detail: `${resolved.meals.length} platillos${premium}`,
    unitPriceCents: resolved.unitPriceCents,
    lineTotalCents: resolved.unitPriceCents * quantity,
    meals: resolved.meals,
    package: resolved.pkg,
  };
}

const selectionKey = (slot: PackageSlot) => `${slot.protein}:${slot.base}:${slot.style}:${slot.salsa}`;

/** Identical compositions merge into one line regardless of how they were added. */
export function lineKey(item: CartItem): string {
  if (item.kind === "meal") return `meal:${selectionKey(item.meal)}:${item.meal.size}`;
  return `package:${item.package}:${item.slots.map(selectionKey).sort().join(",")}`;
}

export const cartTotalCents = (lines: ResolvedLine[]) => lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

const isSlug = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 80 && SLUG_PATTERN.test(value);
const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);

function parseSlot(value: unknown): PackageSlot | null {
  if (typeof value !== "object" || value === null) return null;
  const { protein, base, style, salsa } = value as Record<string, unknown>;
  if (!isSlug(protein) || !isSlug(base) || !isOneOf(PLATE_STYLES, style) || !isOneOf(SALSAS, salsa)) return null;
  return { protein, base, style, salsa };
}

/** Shape check only (untrusted JSON from the client, Redis, or jsonb); resolveLine checks it against the catalog. */
export function parseCartItem(value: unknown): CartItem | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  if (record.kind === "meal") {
    const meal = parseSlot(record.meal);
    const size = (record.meal as Record<string, unknown> | null)?.size;
    if (!meal || !isOneOf(PORTION_SIZES, size)) return null;
    if (!isOneOf(["builder", "template", "reorder"] as const, record.source)) return null;
    if (record.template !== undefined && !isSlug(record.template)) return null;
    return {
      kind: "meal",
      source: record.source,
      ...(record.template ? { template: record.template as string } : {}),
      meal: { ...meal, size },
    };
  }

  if (record.kind === "package") {
    if (!isSlug(record.package) || !Array.isArray(record.slots)) return null;
    if (record.slots.length === 0 || record.slots.length > MAX_PACKAGE_SLOTS) return null;
    const slots = record.slots.map(parseSlot);
    if (slots.some((slot) => slot === null)) return null;
    return { kind: "package", package: record.package, slots: slots as PackageSlot[] };
  }

  return null;
}
