import { pickupPoints, pointsBounds, type LngLat } from "@/lib/locations-data";

const WIDTH = 1000;

export function ZonesSketch({ showPickupPoints = true, className = "" }: { showPickupPoints?: boolean; className?: string }) {
  const [[minLng, minLat], [maxLng, maxLat]] = pointsBounds();
  const latScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const scale = WIDTH / (maxLng - minLng);
  const height = (maxLat - minLat) * scale * (1 / latScale);
  const pad = 48;

  const project = ([lng, lat]: LngLat) =>
    [((lng - minLng) * scale).toFixed(1), (((maxLat - lat) * scale) / latScale).toFixed(1)] as const;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${WIDTH + pad * 2} ${height + pad * 2}`}
      className={className}
      role="img"
      aria-label={`Puntos de recolección: ${pickupPoints.map((point) => point.name).join(", ")}`}
    >
      {showPickupPoints &&
        pickupPoints.map((point) => {
          const [x, y] = project(point.coordinates);
          return (
            <g key={point.slug}>
              <rect x={+x - 10} y={+y - 10} width={20} height={20} rx={5} fill="#111111" />
              <text x={+x} y={+y - 22} textAnchor="middle" fontSize={22} fontWeight={600} className="fill-ink font-sans">
                {point.name}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
