import type { Map as MapLibreMap } from "maplibre-gl";

export type MapColors = {
  land: string;
  water: string;
  park: string;
  building: string;
  road: string;
  casing: string;
  boundary: string;
  label: string;
  halo: string;
};

export const MAP_COLORS: MapColors = {
  land: "#F5F1E8",
  water: "#E4DDCD",
  park: "#ECE6D8",
  building: "#EEE9DE",
  road: "#FFFFFF",
  casing: "rgba(17,17,17,0.08)",
  boundary: "rgba(17,17,17,0.18)",
  label: "#111111",
  halo: "#F5F1E8",
};

export const MAP_COLORS_DARK: MapColors = {
  land: "#121212",
  water: "#1B1D20",
  park: "#161A15",
  building: "#1A1A1A",
  road: "#262626",
  casing: "rgba(255,255,255,0.06)",
  boundary: "rgba(255,255,255,0.16)",
  label: "#E9E4D8",
  halo: "#0E0E0E",
};

/** The palette for the theme currently on <html> (see components/ThemeToggle.tsx). */
export function currentMapColors(): MapColors {
  return document.documentElement.classList.contains("dark") ? MAP_COLORS_DARK : MAP_COLORS;
}

/** OpenFreeMap Positron: free, no key. Tiles, fonts and sprites all come from tiles.openfreemap.org (see the CSP). */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

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

export function applyBrandStyle(map: MapLibreMap, colors: MapColors = MAP_COLORS) {
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
        paint(map, layer.id, "background-color", colors.land);
        break;
      case "fill":
        if (WATER.test(key)) paint(map, layer.id, "fill-color", colors.water);
        else if (PARK.test(key)) paint(map, layer.id, "fill-color", colors.park);
        else if (/building/.test(key)) paint(map, layer.id, "fill-color", colors.building);
        else paint(map, layer.id, "fill-color", colors.land);
        paint(map, layer.id, "fill-outline-color", "rgba(0,0,0,0)");
        break;
      case "line":
        if (WATER.test(key)) {
          paint(map, layer.id, "line-color", colors.water);
        } else if (ROAD.test(key)) {
          paint(map, layer.id, "line-color", CASING.test(key) ? colors.casing : colors.road);
        } else if (/boundary|admin/.test(key)) {
          paint(map, layer.id, "line-color", colors.boundary);
        }
        break;
      case "symbol":
        paint(map, layer.id, "text-color", colors.label);
        paint(map, layer.id, "text-opacity", 0.75);
        paint(map, layer.id, "text-halo-color", colors.halo);
        paint(map, layer.id, "text-halo-width", 1.4);
        paint(map, layer.id, "icon-opacity", 0);
        break;
    }
  }
}
