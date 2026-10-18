// Delivery zones stay in the catalog for later. Checkout pickup points are the four kitchens.
import { kitchenLocations } from "./kitchens";

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

export const MAP_CENTER: LngLat = [-116.97, 32.518];
export const MAP_ZOOM = 11;

/** Pins on /ubicaciones and the home map. Checkout pickup uses these same kitchens. */
export const mapPins: PickupPoint[] = kitchenLocations.map((kitchen) => ({
  slug: kitchen.slug,
  name: kitchen.name,
  address: "",
  hours: "",
  coordinates: [kitchen.longitude, kitchen.latitude],
}));

export const zones: Zone[] = [
  { slug: "zona-rio", name: "Zona Río", days: "Lunes, miércoles y viernes" },
  { slug: "chapultepec", name: "Chapultepec", days: "Lunes, miércoles y viernes" },
  { slug: "hipodromo", name: "Hipódromo", days: "Martes y jueves" },
  { slug: "otay", name: "Otay", days: "Martes y jueves" },
  { slug: "playas", name: "Playas de Tijuana", days: "Miércoles y sábado" },
];

/** Checkout pickup. The name is the kitchen name; the map pins have no street address. */
export const pickupPoints: PickupPoint[] = kitchenLocations.map((kitchen) => ({
  slug: kitchen.slug,
  name: kitchen.name,
  address: "",
  hours: "",
  coordinates: [kitchen.longitude, kitchen.latitude],
}));

export function getZone(slug: string | undefined | null) {
  if (!slug) return undefined;
  return zones.find((zone) => zone.slug === slug);
}

export function getPickupPoint(slug: string | undefined | null) {
  if (!slug) return undefined;
  return pickupPoints.find((point) => point.slug === slug);
}

export function getMapPin(slug: string | undefined | null) {
  if (!slug) return undefined;
  return mapPins.find((pin) => pin.slug === slug);
}

export function pointsBounds(): [LngLat, LngLat] {
  const lngs = mapPins.map((pin) => pin.coordinates[0]);
  const lats = mapPins.map((pin) => pin.coordinates[1]);
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
