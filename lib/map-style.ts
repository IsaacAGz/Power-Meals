import type { Map as MapLibreMap } from "maplibre-gl";

export const MAP_COLORS = {
  land: "#F5F1E8",
  water: "#E4DDCD",
  park: "#ECE6D8",
  building: "#EEE9DE",
  road: "#FFFFFF",
  casing: "rgba(17,17,17,0.08)",
  label: "#111111",
  halo: "#F5F1E8",
  power: "#F5C400",
  ink: "#111111",
} as const;

export function mapTilerStyleUrl(key: string) {
  return `https://api.maptiler.com/maps/dataviz-light/style.json?key=${key}`;
}

const HIDDEN = /poi|transit|rail|railway|station|airport|aeroway|ferry|bus|subway|housenumber|mountain_peak/;
const WATER = /water|ocean|sea|river|lake|bay|marine/;
const PARK = /park|grass|wood|forest|green|cemetery|pitch|golf|scrub|garden|nature|vegetation/;
const ROAD = /road|street|highway|motorway|trunk|primary|secondary|tertiary|minor|path|bridge|tunnel|transportation/;
const CASING = /casing|outline|case/;

type PaintProperty = Parameters<MapLibreMap["setPaintProperty"]>[1];

function paint(map: MapLibreMap, layer: string, property: PaintProperty, value: string | number) {
  try {
    map.setPaintProperty(layer, property, value);
  } catch {
    // Some base layers reject a property; skipping keeps the rest of the recolor intact.
  }
}

export function applyBrandStyle(map: MapLibreMap) {
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    const sourceLayer = "source-layer" in layer ? String(layer["source-layer"] ?? "").toLowerCase() : "";
    const key = `${id} ${sourceLayer}`;

    if (layer.type === "fill-extrusion" || (HIDDEN.test(key) && layer.type !== "background")) {
      map.setLayoutProperty(layer.id, "visibility", "none");
      continue;
    }

    switch (layer.type) {
      case "background":
        paint(map, layer.id, "background-color", MAP_COLORS.land);
        break;
      case "fill":
        if (WATER.test(key)) paint(map, layer.id, "fill-color", MAP_COLORS.water);
        else if (PARK.test(key)) paint(map, layer.id, "fill-color", MAP_COLORS.park);
        else if (/building/.test(key)) paint(map, layer.id, "fill-color", MAP_COLORS.building);
        else paint(map, layer.id, "fill-color", MAP_COLORS.land);
        paint(map, layer.id, "fill-outline-color", "rgba(0,0,0,0)");
        break;
      case "line":
        if (WATER.test(key)) {
          paint(map, layer.id, "line-color", MAP_COLORS.water);
        } else if (ROAD.test(key)) {
          paint(map, layer.id, "line-color", CASING.test(key) ? MAP_COLORS.casing : MAP_COLORS.road);
        } else if (/boundary|admin/.test(key)) {
          paint(map, layer.id, "line-color", "rgba(17,17,17,0.18)");
        }
        break;
      case "symbol":
        paint(map, layer.id, "text-color", MAP_COLORS.label);
        paint(map, layer.id, "text-opacity", 0.75);
        paint(map, layer.id, "text-halo-color", MAP_COLORS.halo);
        paint(map, layer.id, "text-halo-width", 1.4);
        paint(map, layer.id, "icon-opacity", 0);
        break;
    }
  }
}
