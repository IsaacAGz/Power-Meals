// Placeholder catalog: names, descriptions, and prices (MXN) are editable.

export type MenuCategory = "proteina" | "balanceado" | "ligero" | "desayuno";

export type Dish = {
  slug: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  image: string;
};

export const categories: { id: MenuCategory; label: string }[] = [
  { id: "proteina", label: "Alto en proteína" },
  { id: "balanceado", label: "Balanceado" },
  { id: "ligero", label: "Ligero" },
  { id: "desayuno", label: "Desayuno" },
];

export const dishes: Dish[] = [
  {
    slug: "pollo-arroz-integral",
    name: "Pollo a la parrilla con arroz integral",
    description: "Pechuga marinada con limón y ajo, arroz integral y brócoli al vapor.",
    price: 139,
    category: "proteina",
    image: "/images/platillo-pollo-arroz.jpg",
  },
  {
    slug: "res-chimichurri",
    name: "Res con chimichurri",
    description: "Arrachera en rebanadas, papa cambray al horno y ejotes salteados.",
    price: 165,
    category: "proteina",
    image: "/images/platillo-res-chimichurri.jpg",
  },
  {
    slug: "salmon-quinoa",
    name: "Salmón con quinoa",
    description: "Salmón sellado, quinoa tricolor, espárragos asados y limón amarillo.",
    price: 189,
    category: "proteina",
    image: "/images/platillo-salmon-quinoa.jpg",
  },
  {
    slug: "tinga-pollo",
    name: "Tinga de pollo",
    description: "Tinga en chipotle, arroz rojo, frijoles negros y queso fresco.",
    price: 129,
    category: "balanceado",
    image: "/images/platillo-tinga.jpg",
  },
  {
    slug: "pavo-camote",
    name: "Pavo molido con camote",
    description: "Pavo sazonado, camote rostizado, espinaca y cebolla morada encurtida.",
    price: 135,
    category: "balanceado",
    image: "/images/platillo-pavo-camote.jpg",
  },
  {
    slug: "ensalada-chipotle",
    name: "Ensalada de pollo al chipotle",
    description: "Lechuga romana, pollo, frijol negro, elote asado, aguacate y aderezo de chipotle.",
    price: 125,
    category: "ligero",
    image: "/images/platillo-ensalada-chipotle.jpg",
  },
  {
    slug: "tacos-lechuga-camaron",
    name: "Tacos de lechuga con camarón",
    description: "Camarón a la plancha, pico de gallo con mango y col morada.",
    price: 155,
    category: "ligero",
    image: "/images/platillo-tacos-camaron.jpg",
  },
  {
    slug: "hotcakes-avena",
    name: "Hotcakes de avena",
    description: "Hotcakes de avena con fresa, moras, plátano y yogur griego.",
    price: 99,
    category: "desayuno",
    image: "/images/platillo-hotcakes-avena.jpg",
  },
];

export function getDish(slug: string | undefined | null) {
  if (!slug) return undefined;
  return dishes.find((dish) => dish.slug === slug);
}

export function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}
