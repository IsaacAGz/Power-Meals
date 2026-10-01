// Placeholder coverage: zone outlines, delivery days, and pickup points are editable.

import type { FeatureCollection, Polygon } from "geojson";

export type LngLat = [number, number];

export type Zone = {
  slug: string;
  name: string;
  days: string;
  center: LngLat;
  ring: LngLat[];
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

function ring(center: LngLat, radius: [number, number], wobble: number[]): LngLat[] {
  const points: LngLat[] = wobble.map((factor, i) => {
    const angle = (i / wobble.length) * Math.PI * 2;
    return [
      +(center[0] + Math.cos(angle) * radius[0] * factor).toFixed(5),
      +(center[1] + Math.sin(angle) * radius[1] * factor).toFixed(5),
    ];
  });
  return [...points, points[0]];
}

export const zones: Zone[] = [
  {
    slug: "zona-rio",
    name: "Zona Río",
    days: "Lunes, miércoles y viernes",
    center: [-117.0205, 32.5265],
    ring: ring([-117.0205, 32.5265], [0.014, 0.0085], [1, 0.9, 1.05, 0.95, 1.1, 0.9, 1, 1.05]),
  },
  {
    slug: "chapultepec",
    name: "Chapultepec",
    days: "Lunes, miércoles y viernes",
    center: [-117.0205, 32.5045],
    ring: ring([-117.0205, 32.5045], [0.0105, 0.0075], [1, 1.1, 0.9, 1, 1.05, 0.95, 1.1, 0.9]),
  },
  {
    slug: "hipodromo",
    name: "Hipódromo",
    days: "Martes y jueves",
    center: [-116.9955, 32.5075],
    ring: ring([-116.9955, 32.5075], [0.0115, 0.0085], [0.95, 1, 1.1, 0.9, 1, 1.05, 0.95, 1.1]),
  },
  {
    slug: "otay",
    name: "Otay",
    days: "Martes y jueves",
    center: [-116.9555, 32.5315],
    ring: ring([-116.9555, 32.5315], [0.0175, 0.0105], [1, 0.95, 1.05, 1.1, 0.9, 1, 1.05, 0.95]),
  },
  {
    slug: "playas",
    name: "Playas de Tijuana",
    days: "Miércoles y sábado",
    center: [-117.1155, 32.5215],
    ring: ring([-117.1155, 32.5215], [0.0095, 0.0155], [1.05, 0.95, 1, 1.1, 0.95, 1, 0.9, 1.05]),
  },
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

export const zonesGeoJSON: FeatureCollection<Polygon, { slug: string; name: string }> = {
  type: "FeatureCollection",
  features: zones.map((zone) => ({
    type: "Feature",
    properties: { slug: zone.slug, name: zone.name },
    geometry: { type: "Polygon", coordinates: [zone.ring] },
  })),
};

export function zonesBounds(): [LngLat, LngLat] {
  const all = zones.flatMap((zone) => zone.ring);
  const lngs = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
