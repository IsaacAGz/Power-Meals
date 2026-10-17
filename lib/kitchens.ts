/** Production kitchens. Map pins use [longitude, latitude]; the database stores latitude, longitude. */
export const kitchenLocations = [
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

export type KitchenSlug = (typeof kitchenLocations)[number]["slug"];
