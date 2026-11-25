import { describe, expect, it } from "vitest";
import { formatTime, googleMapsUrl, groupHours, hoursLabel, kitchenLocations } from "@/lib/kitchens";

const kitchen = (slug: string) => kitchenLocations.find((k) => k.slug === slug)!;

describe("kitchen hours", () => {
  it("formats times the way Google Maps shows them in es-MX", () => {
    expect(formatTime("11:00")).toBe("11 a.m.");
    expect(formatTime("12:00")).toBe("12 p.m.");
    expect(formatTime("18:30")).toBe("6:30 p.m.");
  });

  it("collapses consecutive days and keeps closed days", () => {
    expect(groupHours(kitchen("otay").hours)).toEqual([
      { days: "Lun – Sáb", hours: "11 a.m. – 6:30 p.m." },
      { days: "Domingo", hours: "Cerrado" },
    ]);
    expect(groupHours(kitchen("rio-tijuana-3ra-etapa").hours)).toEqual([
      { days: "Lunes", hours: "12 p.m. – 7 p.m." },
      { days: "Martes", hours: "Cerrado" },
      { days: "Mié – Jue", hours: "12 p.m. – 7 p.m." },
      { days: "Vie – Sáb", hours: "12 p.m. – 8 p.m." },
      { days: "Domingo", hours: "12 p.m. – 7 p.m." },
    ]);
  });

  it("says every day when the week is uniform", () => {
    expect(hoursLabel(kitchen("zona-rio").hours)).toBe("Todos los días: 10 a.m. – 8 p.m.");
  });

  it("links to a keyless Google Maps search for the place", () => {
    const url = new URL(googleMapsUrl(kitchen("plaza-monarca")));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toContain("Blvd. Manuel Jesús Clouthier 5561");
  });
});
