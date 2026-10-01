import { pickupPoints, zones, zonesBounds, type LngLat } from "@/lib/locations-data";

const WIDTH = 1000;

export function ZonesSketch({ showPickupPoints = true, className = "" }: { showPickupPoints?: boolean; className?: string }) {
  const [[minLng, minLat], [maxLng, maxLat]] = zonesBounds();
  const latScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const scale = WIDTH / (maxLng - minLng);
  const height = (maxLat - minLat) * scale * (1 / latScale);
  const pad = 40;

  const project = ([lng, lat]: LngLat) =>
    [((lng - minLng) * scale).toFixed(1), (((maxLat - lat) * scale) / latScale).toFixed(1)] as const;

  return (
    <svg
      viewBox={`${-pad} ${-pad - 30} ${WIDTH + pad * 2} ${height + pad * 2 + 30}`}
      className={className}
      role="img"
      aria-label={`Zonas de entrega: ${zones.map((zone) => zone.name).join(", ")}`}
    >
      {zones.map((zone) => {
        const [cx] = project(zone.center);
        const top = Math.min(...zone.ring.map((point) => +project(point)[1]));
        return (
          <g key={zone.slug}>
            <polygon
              points={zone.ring.map((point) => project(point).join(",")).join(" ")}
              fill="#F5C400"
              fillOpacity={0.3}
              stroke="#111111"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <text x={cx} y={top - 12} textAnchor="middle" fontSize={24} fontWeight={600} className="fill-ink font-sans">
              {zone.name}
            </text>
          </g>
        );
      })}
      {showPickupPoints &&
        pickupPoints.map((point) => {
          const [x, y] = project(point.coordinates);
          return <rect key={point.slug} x={+x - 9} y={+y - 9} width={18} height={18} rx={5} fill="#111111" />;
        })}
    </svg>
  );
}
