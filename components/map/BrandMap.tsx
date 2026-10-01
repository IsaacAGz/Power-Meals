"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useReducedMotion } from "motion/react";
import { Lightning } from "@phosphor-icons/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { applyBrandStyle, mapTilerStyleUrl } from "@/lib/map-style";
import { getPickupPoint, MAP_CENTER, MAP_ZOOM, pickupPoints, pointsBounds } from "@/lib/locations-data";
import { buildWhatsAppUrl, PICKUP_QUESTION_MESSAGE } from "@/lib/whatsapp";
import { ZonesSketch } from "./ZonesSketch";

export type BrandMapProps = {
  interactive?: boolean;
  cooperativeGestures?: boolean;
  showPickupPoints?: boolean;
  selectedPoint?: string | null;
  onPointClick?: (slug: string) => void;
  padding?: { top: number; right: number; bottom: number; left: number };
  className?: string;
};

type Status = "loading" | "ready" | "error";

export default function BrandMap({
  interactive = true,
  cooperativeGestures = false,
  showPickupPoints = true,
  selectedPoint = null,
  onPointClick,
  padding = { top: 40, right: 40, bottom: 40, left: 40 },
  className = "",
}: BrandMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerEls = useRef<Map<string, HTMLElement>>(new Map());
  const onPointClickRef = useRef(onPointClick);
  const selectedRef = useRef<string | null>(null);
  const paddingRef = useRef(padding);
  const reduce = useReducedMotion();
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const [status, setStatus] = useState<Status>(apiKey ? "loading" : "error");

  useEffect(() => {
    onPointClickRef.current = onPointClick;
  }, [onPointClick]);

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

      map.fitBounds(pointsBounds(), { padding: paddingRef.current, duration: 0 });

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
      });

      map.on("load", () => {
        loaded = true;
        setStatus("ready");
      });

      if (showPickupPoints) {
        for (const point of pickupPoints) {
          const element = document.createElement("button");
          element.type = "button";
          element.className =
            "flex size-9 cursor-pointer items-center justify-center rounded-[12px] border-0 bg-ink p-0 text-power ring-2 ring-cream";
          element.setAttribute("aria-label", `Punto de recolección: ${point.name}`);
          if (selectedRef.current === point.slug) element.classList.replace("ring-cream", "ring-power");
          element.addEventListener("click", () => onPointClickRef.current?.(point.slug));
          const root = createRoot(element);
          root.render(<Lightning weight="bold" className="size-[18px]" />);
          markerRoots.push(root);
          markerEls.current.set(point.slug, element);

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
      markerEls.current.clear();
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
    selectedRef.current = selectedPoint;
    markerEls.current.forEach((element, slug) => {
      const selected = slug === selectedPoint;
      element.classList.toggle("ring-power", selected);
      element.classList.toggle("ring-cream", !selected);
    });
    if (!map || status !== "ready") return;

    const point = getPickupPoint(selectedPoint);
    if (!point) return;
    const camera = { center: point.coordinates, zoom: 14 };
    if (reduce) map.jumpTo(camera);
    else map.flyTo({ ...camera, duration: 900, essential: false });
  }, [selectedPoint, status, reduce]);

  return (
    <div className={`absolute inset-0 overflow-hidden rounded-frame bg-cream ${className}`}>
      <div ref={containerRef} className="size-full" aria-label="Mapa de puntos de recolección en Tijuana" />

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
            El mapa interactivo no está disponible en este momento. Estos son nuestros puntos de recolección.
          </p>
          <a
            href={buildWhatsAppUrl(PICKUP_QUESTION_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 hover:decoration-ink"
          >
            Pregunta por otro punto
          </a>
        </div>
      )}
    </div>
  );
}
