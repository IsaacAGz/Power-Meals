// Retail catalog from POWER_MEALS_Sistema_Maestro_V1 ("02 Menú SKU", "05 Precios Paquetes").
// Prices in MXN cents. Filter tags are merchandising and meant for ops review.
import type { MealPackageRules } from "../db/schema";

export const filterSeed = [
  { slug: "alto-proteina", label: "Alto en proteína" },
  { slug: "alto-carbohidrato", label: "Alto en carbohidrato" },
  { slug: "bajas-calorias", label: "Bajo en calorías" },
  { slug: "vegetariano", label: "Vegetariano" },
] as const;

export const portionSeed = [
  {
    size: "regular",
    label: "Regular",
    basePriceCents: 13_900,
    proteinGrams: 130,
    carbGrams: 130,
    vegGrams: 100,
    doubleCarbGrams: 260,
  },
  {
    size: "plus",
    label: "Plus",
    basePriceCents: 17_900,
    proteinGrams: 200,
    carbGrams: 200,
    vegGrams: 150,
    doubleCarbGrams: 400,
  },
] as const;

export const proteinSeed = [
  { slug: "pollo", name: "Pollo", tier: "base", regularUpgradeCents: 0, plusUpgradeCents: 0 },
  { slug: "molida", name: "Molida", tier: "base", regularUpgradeCents: 0, plusUpgradeCents: 0 },
  { slug: "basa", name: "Basa", tier: "base", regularUpgradeCents: 0, plusUpgradeCents: 0 },
  { slug: "asada", name: "Asada", tier: "premium", regularUpgradeCents: 2_500, plusUpgradeCents: 3_500 },
  { slug: "sirloin", name: "Sirloin", tier: "premium", regularUpgradeCents: 3_500, plusUpgradeCents: 5_000 },
  { slug: "arrachera", name: "Arrachera", tier: "premium", regularUpgradeCents: 5_000, plusUpgradeCents: 7_500 },
  { slug: "salmon", name: "Salmón", tier: "premium", regularUpgradeCents: 7_500, plusUpgradeCents: 11_000 },
] as const;

export const baseSeed = [
  { slug: "pure", name: "Puré", hasCarbPortion: true, includesVeggies: true, allowsDoubleCarb: true },
  { slug: "camote", name: "Camote", hasCarbPortion: true, includesVeggies: true, allowsDoubleCarb: true },
  { slug: "pasta", name: "Pasta", hasCarbPortion: true, includesVeggies: false, allowsDoubleCarb: true },
  { slug: "arroz", name: "Arroz", hasCarbPortion: true, includesVeggies: true, allowsDoubleCarb: true },
  { slug: "ensalada", name: "Ensalada", hasCarbPortion: false, includesVeggies: false, allowsDoubleCarb: false },
] as const;

// Placeholder photos until the menu shoot; reuse the closest existing image per protein.
const imageFor: Record<string, string> = {
  pollo: "/images/platillo-pollo-arroz.jpg",
  molida: "/images/platillo-pavo-camote.jpg",
  basa: "/images/platillo-tacos-camaron.jpg",
  asada: "/images/platillo-res-chimichurri.jpg",
  sirloin: "/images/platillo-res-chimichurri.jpg",
  arrachera: "/images/platillo-res-chimichurri.jpg",
  salmon: "/images/platillo-salmon-quinoa.jpg",
};

type TemplateSeed = {
  sku: number;
  name: string;
  protein: (typeof proteinSeed)[number]["slug"];
  base: (typeof baseSeed)[number]["slug"];
  sauce?: string;
  filters: (typeof filterSeed)[number]["slug"][];
};

const templateRows: TemplateSeed[] = [
  { sku: 1, name: "Pollo + puré + veggies", protein: "pollo", base: "pure", filters: ["alto-proteina"] },
  { sku: 3, name: "Pollo + camote + veggies", protein: "pollo", base: "camote", filters: ["alto-proteina", "alto-carbohidrato"] },
  { sku: 5, name: "Pollo + pasta + crema parmesana", protein: "pollo", base: "pasta", sauce: "crema parmesana", filters: ["alto-carbohidrato"] },
  { sku: 7, name: "Pollo + arroz + veggies", protein: "pollo", base: "arroz", filters: ["alto-proteina"] },
  { sku: 9, name: "Ensalada con pollo", protein: "pollo", base: "ensalada", filters: ["alto-proteina", "bajas-calorias"] },
  { sku: 11, name: "Asada + arroz + veggies", protein: "asada", base: "arroz", filters: ["alto-proteina"] },
  { sku: 13, name: "Asada + puré + veggies", protein: "asada", base: "pure", filters: ["alto-proteina"] },
  { sku: 15, name: "Molida + arroz + veggies", protein: "molida", base: "arroz", filters: [] },
  { sku: 17, name: "Molida + pasta + Pomodoro", protein: "molida", base: "pasta", sauce: "salsa Pomodoro", filters: ["alto-carbohidrato"] },
  { sku: 19, name: "Molida + puré + veggies", protein: "molida", base: "pure", filters: [] },
  { sku: 21, name: "Basa + puré + veggies", protein: "basa", base: "pure", filters: ["bajas-calorias"] },
  { sku: 23, name: "Basa + arroz + veggies", protein: "basa", base: "arroz", filters: ["bajas-calorias"] },
  { sku: 25, name: "Basa + camote + veggies", protein: "basa", base: "camote", filters: ["bajas-calorias", "alto-carbohidrato"] },
  { sku: 27, name: "Sirloin + puré + veggies", protein: "sirloin", base: "pure", filters: ["alto-proteina"] },
  { sku: 29, name: "Sirloin + arroz + veggies", protein: "sirloin", base: "arroz", filters: ["alto-proteina"] },
  { sku: 31, name: "Arrachera + puré + veggies", protein: "arrachera", base: "pure", filters: ["alto-proteina"] },
  { sku: 33, name: "Arrachera + arroz + veggies", protein: "arrachera", base: "arroz", filters: ["alto-proteina"] },
  { sku: 35, name: "Salmón + arroz + veggies", protein: "salmon", base: "arroz", filters: ["alto-proteina"] },
  { sku: 37, name: "Salmón + camote + veggies", protein: "salmon", base: "camote", filters: ["alto-proteina", "alto-carbohidrato"] },
];

const sku = (n: number) => `SKU-${String(n).padStart(2, "0")}`;

function describe(row: TemplateSeed): string {
  const base = baseSeed.find((b) => b.slug === row.base)!;
  if (!base.hasCarbPortion) return "130 g de proteína sobre cama de ensalada (Regular) o 200 g (Plus). Incluye 1 oz de salsa roja o verde.";
  const extras = row.sauce ? ` con ${row.sauce}` : base.includesVeggies ? " y vegetales" : "";
  return `130 g de proteína y 130 g de ${base.name.toLowerCase()}${extras} (Regular), o 200 g y 200 g (Plus). Incluye 1 oz de salsa roja o verde.`;
}

export const templateSeed = templateRows.map((row) => ({
  slug: `${row.protein}-${row.base}`,
  name: row.name,
  description: describe(row),
  protein: row.protein,
  base: row.base,
  imageUrl: imageFor[row.protein],
  skuRegular: sku(row.sku),
  skuPlus: sku(row.sku + 1),
  filters: row.filters,
}));

type PackageProduct = {
  productSlug: string;
  name: string;
  description: string;
  rules: MealPackageRules;
  prices: Record<"regular" | "plus", Record<6 | 10 | 15, number>>;
};

const packageProducts: PackageProduct[] = [
  {
    productSlug: "power-chicken",
    name: "POWER Chicken",
    description: "Paquete solo pollo: elige la base y el estilo de cada comida.",
    rules: { proteinSlugs: ["pollo"], premiumSurcharge: false },
    prices: { regular: { 6: 64_900, 10: 99_900, 15: 149_900 }, plus: { 6: 79_900, 10: 124_900, 15: 179_900 } },
  },
  {
    productSlug: "power-mix",
    name: "POWER Mix",
    description: "Combina proteínas base; las premium suman su diferencia por comida.",
    rules: { premiumSurcharge: true },
    prices: { regular: { 6: 74_900, 10: 119_900, 15: 169_900 }, plus: { 6: 95_900, 10: 154_900, 15: 219_900 } },
  },
];

export const packageSeed = packageProducts.flatMap((product) =>
  (["regular", "plus"] as const).flatMap((size) =>
    ([6, 10, 15] as const).map((mealCount) => ({
      slug: `${product.productSlug}-${mealCount}-${size}`,
      productSlug: product.productSlug,
      name: product.name,
      description: product.description,
      mealCount,
      size,
      priceCents: product.prices[size][mealCount],
      rules: product.rules,
    })),
  ),
);
