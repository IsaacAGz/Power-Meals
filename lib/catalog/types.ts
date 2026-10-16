// Client-safe catalog shapes. The server loads these from PostgreSQL (lib/catalog/index.ts).

export const PORTION_SIZES = ["regular", "plus"] as const;
export const PLATE_STYLES = ["balanced", "double_carb"] as const;
export const SALSAS = ["roja", "verde"] as const;

export type PortionSize = (typeof PORTION_SIZES)[number];
export type PlateStyle = (typeof PLATE_STYLES)[number];
export type Salsa = (typeof SALSAS)[number];

export type Protein = {
  id: string;
  slug: string;
  name: string;
  tier: "base" | "premium";
  upgradeCents: Record<PortionSize, number>;
};

export type CarbBase = {
  id: string;
  slug: string;
  name: string;
  hasCarbPortion: boolean;
  includesVeggies: boolean;
  allowsDoubleCarb: boolean;
};

export type Portion = {
  size: PortionSize;
  label: string;
  basePriceCents: number;
  proteinGrams: number;
  carbGrams: number;
  vegGrams: number;
  doubleCarbGrams: number;
};

export type CatalogFilter = { slug: string; label: string };

export type MealTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  protein: string;
  base: string;
  imageUrl: string;
  filters: string[];
};

export type MealPackage = {
  id: string;
  slug: string;
  productSlug: string;
  name: string;
  description: string;
  mealCount: number;
  size: PortionSize;
  priceCents: number;
  rules: { proteinSlugs?: string[]; premiumSurcharge: boolean };
};

export type Catalog = {
  proteins: Protein[];
  bases: CarbBase[];
  portions: Portion[];
  filters: CatalogFilter[];
  templates: MealTemplate[];
  packages: MealPackage[];
};

export type MealSelection = {
  protein: string;
  base: string;
  size: PortionSize;
  style: PlateStyle;
  salsa: Salsa;
};

/** A package slot takes its size from the package. */
export type PackageSlot = Omit<MealSelection, "size">;

export type CartItem =
  | { kind: "meal"; source: "builder" | "template" | "reorder"; template?: string; meal: MealSelection }
  | { kind: "package"; package: string; slots: PackageSlot[] };

export const portionLabels: Record<PortionSize, string> = { regular: "Regular", plus: "Plus" };
export const styleLabels: Record<PlateStyle, string> = { balanced: "Balanceado", double_carb: "Doble carb" };
export const salsaLabels: Record<Salsa, string> = { roja: "Salsa roja", verde: "Salsa verde" };
