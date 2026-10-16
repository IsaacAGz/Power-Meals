"use client";

import { useState } from "react";
import { CircleNotch, Plus } from "@phosphor-icons/react";
import { mealName, resolvePackage } from "@/lib/catalog/pricing";
import {
  portionLabels,
  salsaLabels,
  styleLabels,
  type CartItem,
  type Catalog,
  type MealPackage,
  type PackageSlot,
  type PortionSize,
} from "@/lib/catalog/types";
import { formatCents } from "@/lib/format";
import { buttonPrimary, inputBase } from "@/lib/ui";
import { ChoiceGroup } from "./ChoiceGroup";

type Product = { productSlug: string; name: string; description: string; rules: MealPackage["rules"] };

function productsOf(catalog: Catalog): Product[] {
  const seen = new Map<string, Product>();
  for (const pkg of catalog.packages) {
    if (!seen.has(pkg.productSlug)) {
      seen.set(pkg.productSlug, { productSlug: pkg.productSlug, name: pkg.name, description: pkg.description, rules: pkg.rules });
    }
  }
  return [...seen.values()];
}

const selectClass = `${inputBase} h-10 border-line-strong pr-2 text-[14px]`;

export function PackageBuilder({
  catalog,
  initialPackage,
  onAdd,
}: {
  catalog: Catalog;
  initialPackage?: string;
  onAdd: (item: CartItem, quantity: number) => Promise<boolean>;
}) {
  const products = productsOf(catalog);
  const start =
    catalog.packages.find((pkg) => pkg.slug === initialPackage) ??
    catalog.packages.find((pkg) => pkg.productSlug === initialPackage) ??
    catalog.packages[0];

  const [productSlug, setProductSlug] = useState(start?.productSlug ?? "");
  const [mealCount, setMealCount] = useState(start?.mealCount ?? 6);
  const [size, setSize] = useState<PortionSize>(start?.size ?? "regular");
  const product = products.find((row) => row.productSlug === productSlug);
  const allowedProteins = catalog.proteins.filter(
    (protein) => !product?.rules.proteinSlugs || product.rules.proteinSlugs.includes(protein.slug),
  );
  const allowedTemplates = catalog.templates.filter((template) => allowedProteins.some((p) => p.slug === template.protein));

  const defaultSlot = (): PackageSlot => {
    const template = allowedTemplates.find((row) => row.base === "arroz") ?? allowedTemplates[0];
    return {
      protein: template?.protein ?? allowedProteins[0]?.slug ?? "",
      base: template?.base ?? catalog.bases[0]?.slug ?? "",
      style: "balanced",
      salsa: "roja",
    };
  };
  const [slots, setSlots] = useState<PackageSlot[]>(() => Array.from({ length: mealCount }, defaultSlot));
  const [pending, setPending] = useState(false);

  const variant = catalog.packages.find(
    (pkg) => pkg.productSlug === productSlug && pkg.mealCount === mealCount && pkg.size === size,
  );
  const resolved = variant ? resolvePackage(catalog, variant.slug, slots) : null;
  const counts = [...new Set(catalog.packages.filter((pkg) => pkg.productSlug === productSlug).map((pkg) => pkg.mealCount))];

  function resize(count: number, allowed = allowedProteins) {
    setMealCount(count);
    setSlots((current) =>
      Array.from({ length: count }, (_, index) => {
        const slot = current[index] ?? current[0] ?? defaultSlot();
        return allowed.some((protein) => protein.slug === slot.protein) ? slot : { ...slot, protein: allowed[0].slug };
      }),
    );
  }

  function chooseProduct(slug: string) {
    const next = products.find((row) => row.productSlug === slug);
    const allowed = catalog.proteins.filter((p) => !next?.rules.proteinSlugs || next.rules.proteinSlugs.includes(p.slug));
    setProductSlug(slug);
    resize(mealCount, allowed);
  }

  function updateSlot(index: number, patch: Partial<PackageSlot>) {
    setSlots((current) =>
      current.map((slot, i) => {
        if (i !== index) return slot;
        const next = { ...slot, ...patch };
        if (!catalog.bases.find((base) => base.slug === next.base)?.allowsDoubleCarb) next.style = "balanced";
        return next;
      }),
    );
  }

  function fillAll(templateSlug: string) {
    const template = allowedTemplates.find((row) => row.slug === templateSlug);
    if (!template) return;
    setSlots((current) => current.map((slot) => ({ ...slot, protein: template.protein, base: template.base, style: "balanced" })));
  }

  async function add() {
    if (!variant || !resolved) return;
    setPending(true);
    await onAdd({ kind: "package", package: variant.slug, slots }, 1);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <ChoiceGroup
        legend="Paquete"
        value={productSlug}
        onChange={chooseProduct}
        className="grid-cols-1 sm:grid-cols-2"
        options={products.map((row) => ({ value: row.productSlug, label: row.name, note: row.description }))}
      />

      <div className="grid gap-8 sm:grid-cols-2">
        <ChoiceGroup
          legend="Comidas"
          value={String(mealCount)}
          onChange={(value) => resize(Number(value))}
          className="grid-cols-3"
          options={counts.map((count) => ({ value: String(count), label: `${count}` }))}
        />
        <ChoiceGroup
          legend="Tamaño"
          value={size}
          onChange={setSize}
          className="grid-cols-2"
          options={catalog.portions.map((portion) => {
            const price = catalog.packages.find(
              (pkg) => pkg.productSlug === productSlug && pkg.mealCount === mealCount && pkg.size === portion.size,
            )?.priceCents;
            return { value: portion.size, label: portionLabels[portion.size], hint: price ? formatCents(price) : undefined };
          })}
        />
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Tus {mealCount} comidas</p>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Llenar todas con
            <select defaultValue="" onChange={(event) => fillAll(event.target.value)} className={`${selectClass} w-auto`}>
              <option value="" disabled>
                Elige un platillo
              </option>
              {allowedTemplates.map((template) => (
                <option key={template.slug} value={template.slug}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ol className="mt-4 flex flex-col divide-y divide-line rounded-frame border border-line-strong bg-paper">
          {slots.map((slot, index) => {
            const protein = catalog.proteins.find((row) => row.slug === slot.protein);
            const base = catalog.bases.find((row) => row.slug === slot.base);
            const upgrade = product?.rules.premiumSurcharge && protein ? protein.upgradeCents[size] : 0;
            return (
              <li key={index} className="grid gap-2 p-3 sm:grid-cols-[5.5rem_1fr_1fr_1fr_1fr] sm:items-center">
                <span className="text-[13px] font-semibold text-muted">
                  Comida {index + 1}
                  {upgrade > 0 && <span className="block font-mono text-[12px]">+{formatCents(upgrade)}</span>}
                </span>
                <select
                  aria-label={`Proteína, comida ${index + 1}`}
                  value={slot.protein}
                  onChange={(event) => updateSlot(index, { protein: event.target.value })}
                  className={selectClass}
                >
                  {allowedProteins.map((row) => (
                    <option key={row.slug} value={row.slug}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Base, comida ${index + 1}`}
                  value={slot.base}
                  onChange={(event) => updateSlot(index, { base: event.target.value })}
                  className={selectClass}
                >
                  {catalog.bases.map((row) => (
                    <option key={row.slug} value={row.slug}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Estilo, comida ${index + 1}`}
                  value={slot.style}
                  disabled={!base?.allowsDoubleCarb}
                  onChange={(event) => updateSlot(index, { style: event.target.value as PackageSlot["style"] })}
                  className={`${selectClass} disabled:opacity-50`}
                >
                  <option value="balanced">{styleLabels.balanced}</option>
                  <option value="double_carb">{styleLabels.double_carb}</option>
                </select>
                <select
                  aria-label={`Salsa, comida ${index + 1}`}
                  value={slot.salsa}
                  onChange={(event) => updateSlot(index, { salsa: event.target.value as PackageSlot["salsa"] })}
                  className={selectClass}
                >
                  <option value="roja">{salsaLabels.roja}</option>
                  <option value="verde">{salsaLabels.verde}</option>
                </select>
                {protein && base && (
                  <span className="text-[12px] text-muted sm:col-start-2 sm:col-end-6">
                    {mealName(protein, base, slot.style)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-5 rounded-frame border border-ink bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-xl font-bold tracking-tight">
            {variant ? `${variant.name} · ${variant.mealCount} comidas ${portionLabels[variant.size]}` : "Paquete no disponible"}
          </p>
          {resolved && resolved.surchargeCents > 0 && (
            <p className="mt-1 text-[13px] text-muted">
              {formatCents(variant!.priceCents)} + {formatCents(resolved.surchargeCents)} por proteínas premium
            </p>
          )}
        </div>
        <button type="button" onClick={add} disabled={!resolved || pending} className={`${buttonPrimary} min-w-[200px]`}>
          {pending ? (
            <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />
          ) : (
            <Plus weight="bold" className="size-4" aria-hidden />
          )}
          Agregar {resolved ? formatCents(resolved.unitPriceCents) : ""}
        </button>
      </div>
    </div>
  );
}
