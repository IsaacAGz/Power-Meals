import { describe, expect, it } from "vitest";
import {
  cartTotalCents,
  lineKey,
  mealName,
  parseCartItem,
  resolveLine,
  resolveMeal,
  resolvePackage,
} from "@/lib/catalog/pricing";
import { meal, seedCatalog, slots } from "../fixtures/catalog";

const catalog = seedCatalog();
const protein = (slug: string) => catalog.proteins.find((row) => row.slug === slug)!;
const base = (slug: string) => catalog.bases.find((row) => row.slug === slug)!;

describe("resolveMeal", () => {
  it("prices a regular base-protein plate at $139", () => {
    const resolved = resolveMeal(catalog, { protein: "pollo", base: "arroz", size: "regular", style: "balanced", salsa: "roja" });
    expect(resolved).toMatchObject({
      unitPriceCents: 13_900,
      upgradeCents: 0,
      proteinGrams: 130,
      carbGrams: 130,
      vegGrams: 100,
      salsaNote: "Salsa roja 1 oz",
      name: "Pollo + arroz + veggies",
    });
  });

  it("adds the premium upgrade for the portion size", () => {
    expect(resolveMeal(catalog, { protein: "salmon", base: "arroz", size: "regular", style: "balanced", salsa: "verde" })?.unitPriceCents).toBe(
      13_900 + 7_500,
    );
    expect(resolveMeal(catalog, { protein: "salmon", base: "arroz", size: "plus", style: "balanced", salsa: "verde" })?.unitPriceCents).toBe(
      17_900 + 11_000,
    );
  });

  it("doubles the carb and drops the veggies for doble carb", () => {
    const resolved = resolveMeal(catalog, { protein: "pollo", base: "arroz", size: "plus", style: "double_carb", salsa: "roja" });
    expect(resolved).toMatchObject({ carbGrams: 400, vegGrams: 0, name: "Pollo + doble arroz" });
  });

  it("rejects doble carb on a base that does not allow it", () => {
    expect(resolveMeal(catalog, { protein: "pollo", base: "ensalada", size: "regular", style: "double_carb", salsa: "roja" })).toBeNull();
  });

  it("gives a salad no carb grams", () => {
    const resolved = resolveMeal(catalog, { protein: "pollo", base: "ensalada", size: "regular", style: "balanced", salsa: "roja" });
    expect(resolved).toMatchObject({ carbGrams: 0, vegGrams: 0, name: "Ensalada con pollo" });
  });

  it("returns null for an unknown protein, base, or size", () => {
    expect(resolveMeal(catalog, { protein: "tofu", base: "arroz", size: "regular", style: "balanced", salsa: "roja" })).toBeNull();
    expect(resolveMeal(catalog, { protein: "pollo", base: "quinoa", size: "regular", style: "balanced", salsa: "roja" })).toBeNull();
    expect(
      resolveMeal(catalog, { protein: "pollo", base: "arroz", size: "jumbo" as "regular", style: "balanced", salsa: "roja" }),
    ).toBeNull();
  });
});

describe("mealName", () => {
  it("uses the template name when one matches", () => {
    const template = catalog.templates.find((row) => row.slug === "pollo-pasta");
    expect(mealName(protein("pollo"), base("pasta"), "balanced", template)).toBe("Pollo + pasta + crema parmesana");
  });

  it("omits veggies for a base without them", () => {
    expect(mealName(protein("asada"), base("pasta"), "balanced")).toBe("Asada + pasta");
  });
});

describe("resolvePackage", () => {
  it("prices POWER Chicken at the package price with no surcharge", () => {
    const resolved = resolvePackage(catalog, "power-chicken-6-regular", slots(6));
    expect(resolved).toMatchObject({ surchargeCents: 0, unitPriceCents: 64_900 });
    expect(resolved?.meals).toHaveLength(6);
  });

  it("rejects a protein the package does not allow", () => {
    expect(resolvePackage(catalog, "power-chicken-6-regular", [...slots(5), ...slots(1, { protein: "asada" })])).toBeNull();
  });

  it("adds each premium protein's upgrade to POWER Mix", () => {
    const resolved = resolvePackage(catalog, "power-mix-6-plus", [...slots(4), ...slots(2, { protein: "arrachera" })]);
    expect(resolved).toMatchObject({ surchargeCents: 2 * 7_500, unitPriceCents: 95_900 + 2 * 7_500 });
  });

  it("requires exactly the package's meal count", () => {
    expect(resolvePackage(catalog, "power-mix-10-regular", slots(9))).toBeNull();
    expect(resolvePackage(catalog, "power-mix-10-regular", slots(11))).toBeNull();
  });

  it("uses the package size for every slot", () => {
    const resolved = resolvePackage(catalog, "power-chicken-10-plus", slots(10));
    expect(resolved?.meals.every((row) => row.portion.size === "plus")).toBe(true);
  });
});

describe("resolveLine and cartTotalCents", () => {
  it("multiplies the unit price by quantity and sums lines", () => {
    const plate = resolveLine(catalog, meal(), 3)!;
    const pkg = resolveLine(catalog, { kind: "package", package: "power-chicken-6-regular", slots: slots(6) }, 1)!;
    expect(plate.lineTotalCents).toBe(3 * 13_900);
    expect(plate.displayName).toBe("Pollo + arroz + veggies · Regular");
    expect(pkg.displayName).toBe("POWER Chicken · 6 comidas Regular");
    expect(pkg.detail).toBe("6 platillos");
    expect(cartTotalCents([plate, pkg])).toBe(3 * 13_900 + 64_900);
  });

  it("notes premium proteins on a package line", () => {
    const line = resolveLine(catalog, { kind: "package", package: "power-mix-6-regular", slots: [...slots(5), ...slots(1, { protein: "salmon" })] }, 1);
    expect(line?.detail).toBe("6 platillos · incluye proteínas premium");
  });

  it("returns null when the catalog no longer has the item", () => {
    expect(resolveLine(catalog, meal({ protein: "retired" }), 1)).toBeNull();
  });
});

describe("lineKey", () => {
  it("merges the same plate regardless of where it came from", () => {
    const fromTemplate = { ...meal(), source: "template" as const, template: "pollo-arroz" };
    expect(lineKey(meal())).toBe(lineKey(fromTemplate));
  });

  it("keeps sizes and salsas apart", () => {
    expect(lineKey(meal())).not.toBe(lineKey(meal({ size: "plus" })));
    expect(lineKey(meal())).not.toBe(lineKey(meal({ salsa: "verde" })));
  });

  it("ignores slot order inside a package", () => {
    const a = { kind: "package" as const, package: "power-mix-6-regular", slots: [...slots(5), ...slots(1, { protein: "asada" })] };
    const b = { ...a, slots: [...slots(1, { protein: "asada" }), ...slots(5)] };
    expect(lineKey(a)).toBe(lineKey(b));
  });
});

describe("parseCartItem", () => {
  it("accepts a well-formed meal and package", () => {
    expect(parseCartItem(meal())).toEqual(meal());
    const pkg = { kind: "package", package: "power-chicken-6-regular", slots: slots(6) };
    expect(parseCartItem(pkg)).toEqual(pkg);
  });

  it("drops unknown fields such as a client price", () => {
    expect(parseCartItem({ ...meal(), unitPriceCents: 1 })).toEqual(meal());
  });

  it.each([
    ["null", null],
    ["a string", "meal"],
    ["an unknown kind", { kind: "dish" }],
    ["a bad slug", meal({ protein: "Pollo; DROP" })],
    ["a bad size", meal({ size: "xl" as "regular" })],
    ["a bad style", meal({ style: "triple" as "balanced" })],
    ["a bad salsa", meal({ salsa: "mole" as "roja" })],
    ["a bad source", { ...meal(), source: "admin" }],
    ["an empty package", { kind: "package", package: "power-mix-6-regular", slots: [] }],
    ["too many slots", { kind: "package", package: "power-mix-6-regular", slots: slots(31) }],
    ["a malformed slot", { kind: "package", package: "power-mix-6-regular", slots: [...slots(5), { protein: "pollo" }] }],
  ])("rejects %s", (_label, value) => {
    expect(parseCartItem(value)).toBeNull();
  });
});
