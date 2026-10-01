"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useReducedMotion } from "motion/react";
import { Lightning } from "@phosphor-icons/react";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { applyBrandStyle, MAP_COLORS, mapTilerStyleUrl } from "@/lib/map-style";
import { getZone, MAP_CENTER, MAP_ZOOM, pickupPoints, zonesBounds, zonesGeoJSON } from "@/lib/locations-data";
import { buildWhatsAppUrl, ZONE_QUESTION_MESSAGE } from "@/lib/whatsapp";
import { ZonesSketch } from "./ZonesSketch";

export type BrandMapProps = {
  interactive?: boolean;
  cooperativeGestures?: boolean;
  showPickupPoints?: boolean;
  selectedZone?: string | null;
  onZoneClick?: (slug: string) => void;
  padding?: { top: number; right: number; bottom: number; left: number };
  className?: string;
};

type Status = "loading" | "ready" | "error";

const SOURCE = "pm-zones";
const FILL = "pm-zones-fill";
const LINE = "pm-zones-line";

export default function BrandMap({
  interactive = true,
  cooperativeGestures = false,
  showPickupPoints = true,
  selectedZone = null,
  onZoneClick,
  padding = { top: 40, right: 40, bottom: 40, left: 40 },
  className = "",
}: BrandMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onZoneClickRef = useRef(onZoneClick);
  const selectedRef = useRef<string | null>(null);
  const paddingRef = useRef(padding);
  const reduce = useReducedMotion();
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const [status, setStatus] = useState<Status>(apiKey ? "loading" : "error");

  useEffect(() => {
    onZoneClickRef.current = onZoneClick;
  }, [onZoneClick]);

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;
    const markerRoots: Root[] = [];
    const markers: { remove: () => void }[] = [];

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: mapTilerStyleUrl(apiKey),
          center: MAP_CENTER,
          zoom: MAP_ZOOM,
          interactive,
          cooperativeGestures: interactive && cooperativeGestures,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
      } catch {
        setStatus("error");
        return;
      }

      mapRef.current = map;
      let loaded = false;

      map.fitBounds(zonesBounds(), { padding: paddingRef.current, duration: 0 });

      if (interactive) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      }

      map.on("error", (event) => {
        if (!loaded) {
          console.warn("[BrandMap]", event.error?.message);
          setStatus("error");
        }
      });

      map.on("style.load", () => {
        if (!map) return;
        applyBrandStyle(map);

        map.addSource(SOURCE, { type: "geojson", data: zonesGeoJSON, promoteId: "slug" });
        map.addLayer({
          id: FILL,
          type: "fill",
          source: SOURCE,
          paint: {
            "fill-color": MAP_COLORS.power,
            "fill-opacity": [
              "case",
              ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "selected"], false]],
              0.45,
              0.22,
            ],
          },
        });
        map.addLayer({
          id: LINE,
          type: "line",
          source: SOURCE,
          paint: { "line-color": MAP_COLORS.ink, "line-width": 1.25 },
        });

        if (selectedRef.current) {
          map.setFeatureState({ source: SOURCE, id: selectedRef.current }, { selected: true });
        }
      });

      map.on("load", () => {
        loaded = true;
        setStatus("ready");
      });

      if (interactive) {
        let hovered: string | null = null;
        const setHover = (slug: string | null) => {
          if (!map) return;
          if (hovered) map.setFeatureState({ source: SOURCE, id: hovered }, { hover: false });
          hovered = slug;
          if (slug) map.setFeatureState({ source: SOURCE, id: slug }, { hover: true });
          map.getCanvas().style.cursor = slug ? "pointer" : "";
        };

        map.on("mousemove", FILL, (event: MapLayerMouseEvent) => {
          const slug = event.features?.[0]?.properties?.slug as string | undefined;
          if (slug !== hovered) setHover(slug ?? null);
        });
        map.on("mouseleave", FILL, () => setHover(null));
        map.on("click", FILL, (event: MapLayerMouseEvent) => {
          const slug = event.features?.[0]?.properties?.slug as string | undefined;
          if (slug) onZoneClickRef.current?.(slug);
        });
      }

      if (showPickupPoints) {
        for (const point of pickupPoints) {
          const element = document.createElement("div");
          element.className =
            "flex size-9 items-center justify-center rounded-[12px] bg-ink text-power ring-2 ring-cream cursor-pointer";
          element.setAttribute("role", "img");
          element.setAttribute("aria-label", `Punto de recolección: ${point.name}`);
          const root = createRoot(element);
          root.render(<Lightning weight="bold" className="size-[18px]" />);
          markerRoots.push(root);

          const popupBody = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = point.name;
          title.className = "block font-semibold";
          const address = document.createElement("span");
          address.textContent = point.address;
          address.className = "block text-muted";
          const hours = document.createElement("span");
          hours.textContent = point.hours;
          hours.className = "mt-1 block text-[12px] text-muted";
          popupBody.append(title, address, hours);

          const marker = new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat(point.coordinates)
            .setPopup(new maplibregl.Popup({ offset: 22, closeButton: false }).setDOMContent(popupBody))
            .addTo(map);
          markers.push(marker);
        }
      }
    })();

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      const roots = markerRoots.splice(0);
      queueMicrotask(() => roots.forEach((root) => root.unmount()));
      map?.remove();
      mapRef.current = null;
    };
  }, [apiKey, interactive, showPickupPoints]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactive) return;
    if (cooperativeGestures) map.cooperativeGestures.enable();
    else map.cooperativeGestures.disable();
  }, [cooperativeGestures, interactive, status]);

  useEffect(() => {
    const map = mapRef.current;
    const previous = selectedRef.current;
    selectedRef.current = selectedZone;
    if (!map || status !== "ready") return;

    if (previous && previous !== selectedZone) {
      map.setFeatureState({ source: SOURCE, id: previous }, { selected: false });
    }
    const zone = getZone(selectedZone);
    if (!zone) return;

    map.setFeatureState({ source: SOURCE, id: zone.slug }, { selected: true });
    const camera = { center: zone.center, zoom: 13 };
    if (reduce) map.jumpTo(camera);
    else map.flyTo({ ...camera, duration: 900, essential: false });
  }, [selectedZone, status, reduce]);

  return (
    <div className={`absolute inset-0 overflow-hidden rounded-frame bg-cream ${className}`}>
      <div ref={containerRef} className="size-full" aria-label="Mapa de zonas de entrega en Tijuana" />

      {status === "loading" && (
        <div aria-hidden className="absolute inset-0 bg-[#EFEADF] motion-safe:animate-pulse" />
      )}

      {status === "error" && (
        <MapFallback quiet={!interactive} padding={padding} showPickupPoints={showPickupPoints} />
      )}
    </div>
  );
}

function MapFallback({
  quiet,
  padding,
  showPickupPoints,
}: {
  quiet: boolean;
  padding: NonNullable<BrandMapProps["padding"]>;
  showPickupPoints: boolean;
}) {
  return (
    <div className="absolute inset-0 bg-[#EFEADF]">
      <div
        className="absolute"
        style={
          quiet
            ? { top: padding.top, right: padding.right, bottom: padding.bottom, left: padding.left }
            : { top: 32, right: 32, bottom: 150, left: 32 }
        }
      >
        <ZonesSketch showPickupPoints={showPickupPoints} className="size-full" />
      </div>
      {!quiet && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 border-t border-line bg-cream/80 p-6">
          <p className="max-w-[48ch] text-[15px] leading-relaxed text-muted">
            El mapa interactivo no está disponible en este momento. Este es el contorno aproximado de nuestras zonas.
          </p>
          <a
            href={buildWhatsAppUrl(ZONE_QUESTION_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 hover:decoration-ink"
          >
            Pregunta por tu zona
          </a>
        </div>
      )}
    </div>
  );
}
