// Placeholder coverage: delivery zones for the order form, and drop-off points for the map.

export type LngLat = [number, number];

export type Zone = {
  slug: string;
  name: string;
  days: string;
};

export type PickupPoint = {
  slug: string;
  name: string;
  address: string;
  hours: string;
  coordinates: LngLat;
};

export const MAP_CENTER: LngLat = [-117.038, 32.515];
export const MAP_ZOOM = 11;

export const zones: Zone[] = [
  { slug: "zona-rio", name: "Zona Río", days: "Lunes, miércoles y viernes" },
  { slug: "chapultepec", name: "Chapultepec", days: "Lunes, miércoles y viernes" },
  { slug: "hipodromo", name: "Hipódromo", days: "Martes y jueves" },
  { slug: "otay", name: "Otay", days: "Martes y jueves" },
  { slug: "playas", name: "Playas de Tijuana", days: "Miércoles y sábado" },
];

export const pickupPoints: PickupPoint[] = [
  {
    slug: "recoleccion-zona-rio",
    name: "Punto Zona Río",
    address: "Paseo de los Héroes, Zona Río",
    hours: "Lunes a sábado, 9:00 a 18:00",
    coordinates: [-117.0172, 32.5268],
  },
  {
    slug: "recoleccion-playas",
    name: "Punto Playas",
    address: "Paseo Ensenada, Playas de Tijuana",
    hours: "Miércoles y sábado, 10:00 a 16:00",
    coordinates: [-117.1215, 32.5238],
  },
];

export function getZone(slug: string | undefined | null) {
  if (!slug) return undefined;
  return zones.find((zone) => zone.slug === slug);
}

export function getPickupPoint(slug: string | undefined | null) {
  if (!slug) return undefined;
  return pickupPoints.find((point) => point.slug === slug);
}

export function pointsBounds(): [LngLat, LngLat] {
  const lngs = pickupPoints.map((point) => point.coordinates[0]);
  const lats = pickupPoints.map((point) => point.coordinates[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.02);
  const latPad = Math.max((maxLat - minLat) * 0.4, 0.02);
  return [
    [minLng - lngPad, minLat - latPad],
    [maxLng + lngPad, maxLat + latPad],
  ];
}
