import { describe, expect, it } from "vitest";
import { mixPlates } from "@/lib/catalog/menu";
import { templateSeed } from "@/lib/catalog/seed-data";

describe("mixPlates", () => {
  const plates = templateSeed.map((t) => ({ slug: t.name, protein: t.protein, base: t.base }));
  const mixed = mixPlates(plates);

  it("keeps every plate exactly once", () => {
    expect(mixed).toHaveLength(plates.length);
    expect(new Set(mixed.map((p) => p.slug))).toEqual(new Set(plates.map((p) => p.slug)));
  });

  it("never puts the same protein next to itself", () => {
    for (let i = 1; i < mixed.length; i++) expect(mixed[i].protein).not.toBe(mixed[i - 1].protein);
  });

  it("starts with a different protein in each of the first cards", () => {
    const firstFive = mixed.slice(0, 5).map((p) => p.protein);
    expect(new Set(firstFive).size).toBe(5);
  });
});

describe("mixPlates order", () => {
  it("is the same on every call", () => {
    const plates = templateSeed.map((t) => ({ slug: t.name, protein: t.protein, base: t.base }));
    expect(mixPlates(plates)).toEqual(mixPlates(plates));
  });
});
