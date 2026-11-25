/** Opening hours for one day, 24-hour "HH:MM". Days without an entry are closed. */
export type DayHours = { open: string; close: string };

/** Index 0 is Monday (lunes), 6 is Sunday (domingo). */
export type WeekHours = readonly [
  DayHours | null,
  DayHours | null,
  DayHours | null,
  DayHours | null,
  DayHours | null,
  DayHours | null,
  DayHours | null,
];

const h = (open: string, close: string): DayHours => ({ open, close });

/**
 * Production kitchens. Map pins use [longitude, latitude]; the database stores latitude, longitude.
 * Slugs are internal ids (staff `--facility`, seed upserts) and stay fixed when a display name changes.
 */
export const kitchenLocations = [
  {
    slug: "zona-rio",
    name: "Plaza Río",
    address: "Pl. Río Tijuana, Zona Urbana Río Tijuana, 22010 Tijuana, B.C.",
    hours: [h("10:00", "20:00"), h("10:00", "20:00"), h("10:00", "20:00"), h("10:00", "20:00"), h("10:00", "20:00"), h("10:00", "20:00"), h("10:00", "20:00")],
    latitude: 32.52820512415235,
    longitude: -117.01893541543576,
  },
  {
    slug: "otay",
    name: "Otay",
    address: "Plaza San Miguel, Otay 1460, Nueva Tijuana, 22435 Tijuana, B.C.",
    hours: [h("11:00", "18:30"), h("11:00", "18:30"), h("11:00", "18:30"), h("11:00", "18:30"), h("11:00", "18:30"), h("11:00", "18:30"), null],
    latitude: 32.53809645350098,
    longitude: -116.92983513766147,
  },
  {
    slug: "plaza-monarca",
    name: "Plaza Monarca",
    address: "Plaza Monarca, Blvd. Manuel Jesús Clouthier 5561, Lago Sur, 22550 Tijuana, B.C.",
    hours: [h("12:00", "20:00"), h("12:00", "20:00"), h("12:00", "20:00"), h("12:00", "20:00"), h("12:00", "20:00"), h("12:00", "21:00"), h("12:00", "21:00")],
    latitude: 32.500821014237935,
    longitude: -116.92067276725912,
  },
  {
    slug: "rio-tijuana-3ra-etapa",
    name: "El Punto",
    address: "P.º del Río 6642, Río Tijuana 3a. Etapa, 22120 Tijuana, B.C.",
    hours: [h("12:00", "19:00"), null, h("12:00", "19:00"), h("12:00", "19:00"), h("12:00", "20:00"), h("12:00", "20:00"), h("12:00", "19:00")],
    latitude: 32.497178312977205,
    longitude: -116.93127319919203,
  },
] as const satisfies readonly {
  slug: string;
  name: string;
  address: string;
  hours: WeekHours;
  latitude: number;
  longitude: number;
}[];

export type KitchenSlug = (typeof kitchenLocations)[number]["slug"];

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

/** "18:30" → "6:30 p.m.", "12:00" → "12 p.m." (es-MX, as Google Maps shows it). */
export function formatTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours < 12 ? "a.m." : "p.m.";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes ? `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}` : `${hour12} ${suffix}`;
}

function formatDay(day: DayHours | null): string {
  return day ? `${formatTime(day.open)} – ${formatTime(day.close)}` : "Cerrado";
}

export type HoursRow = { days: string; hours: string };

/** Consecutive days with the same hours collapse into one row: "Lun – Sáb", "11 a.m. – 6:30 p.m.". */
export function groupHours(week: WeekHours): HoursRow[] {
  const rows: HoursRow[] = [];
  let start = 0;
  for (let i = 1; i <= 7; i++) {
    if (i < 7 && formatDay(week[i]) === formatDay(week[start])) continue;
    const end = i - 1;
    const days = start === 0 && end === 6 ? "Todos los días" : start === end ? DAY_NAMES[start] : `${DAY_SHORT[start]} – ${DAY_SHORT[end]}`;
    rows.push({ days, hours: formatDay(week[start]) });
    start = i;
  }
  return rows;
}

/** One line for places that have no room for a table (map popup, pickup_points.hours_label). */
export function hoursLabel(week: WeekHours): string {
  return groupHours(week)
    .map((row) => `${row.days}: ${row.hours}`)
    .join(" · ");
}

/** A Google Maps search link for the place. Free and keyless (Maps URLs, not the Maps API). */
export function googleMapsUrl(kitchen: { name: string; address: string }): string {
  const query = encodeURIComponent(`${kitchen.name}, ${kitchen.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
