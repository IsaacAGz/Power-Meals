"use client";

import { useState } from "react";
import { CircleNotch, Plus, Trash } from "@phosphor-icons/react";
import { findTemplateFor, mealName, resolvePackage } from "@/lib/catalog/pricing";
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
import { buttonPrimary, buttonSecondary, inputBase } from "@/lib/ui";
import { ChoiceGroup, QuantityStepper } from "./ChoiceGroup";

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

type Group = { id: number; slot: PackageSlot; count: number };

let groupCounter = 0;
const nextGroupId = () => ++groupCounter;

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
  // The package is a list of combinations: one plate and how many of the package's meals it fills.
  const [groups, setGroups] = useState<Group[]>(() => [{ id: nextGroupId(), slot: defaultSlot(), count: mealCount }]);
  const [pending, setPending] = useState(false);

  const slots = groups.flatMap((group) => Array.from({ length: group.count }, () => group.slot));
  const filled = slots.length;
  const remaining = mealCount - filled;

  const variant = catalog.packages.find(
    (pkg) => pkg.productSlug === productSlug && pkg.mealCount === mealCount && pkg.size === size,
  );
  const resolved = variant && remaining === 0 ? resolvePackage(catalog, variant.slug, slots) : null;
  const counts = [...new Set(catalog.packages.filter((pkg) => pkg.productSlug === productSlug).map((pkg) => pkg.mealCount))];

  /** Premium difference per meal for this product and size; POWER Chicken has none. */
  const upgradeFor = (proteinSlug: string) =>
    product?.rules.premiumSurcharge ? (catalog.proteins.find((row) => row.slug === proteinSlug)?.upgradeCents[size] ?? 0) : 0;
  const withUpgrade = (label: string, proteinSlug: string) => {
    const upgrade = upgradeFor(proteinSlug);
    return upgrade > 0 ? `${label} (+${formatCents(upgrade)})` : label;
  };

  function fitGroups(current: Group[], count: number, allowed: typeof allowedProteins): Group[] {
    const fixed = current.map((group) =>
      allowed.some((protein) => protein.slug === group.slot.protein)
        ? group
        : { ...group, slot: { ...group.slot, protein: allowed[0].slug } },
    );
    const total = fixed.reduce((sum, group) => sum + group.count, 0);
    if (total === count) return fixed;
    if (total < count) {
      // More meals: the last combination takes them.
      return fixed.map((group, index) => (index === fixed.length - 1 ? { ...group, count: group.count + count - total } : group));
    }
    // Fewer meals: trim from the last combinations first.
    let extra = total - count;
    const trimmed = [...fixed];
    for (let index = trimmed.length - 1; index >= 0 && extra > 0; index--) {
      const take = Math.min(extra, trimmed[index].count);
      trimmed[index] = { ...trimmed[index], count: trimmed[index].count - take };
      extra -= take;
    }
    const kept = trimmed.filter((group) => group.count > 0);
    return kept.length > 0 ? kept : [{ ...fixed[0], count }];
  }

  function resize(count: number, allowed = allowedProteins) {
    setMealCount(count);
    setGroups((current) => fitGroups(current, count, allowed));
  }

  function chooseProduct(slug: string) {
    const next = products.find((row) => row.productSlug === slug);
    const allowed = catalog.proteins.filter((p) => !next?.rules.proteinSlugs || next.rules.proteinSlugs.includes(p.slug));
    setProductSlug(slug);
    resize(mealCount, allowed);
  }

  function updateGroup(id: number, patch: Partial<PackageSlot>) {
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== id) return group;
        const slot = { ...group.slot, ...patch };
        if (!catalog.bases.find((base) => base.slug === slot.base)?.allowsDoubleCarb) slot.style = "balanced";
        return { ...group, slot };
      }),
    );
  }

  function applyTemplate(id: number, templateSlug: string) {
    const template = allowedTemplates.find((row) => row.slug === templateSlug);
    if (template) updateGroup(id, { protein: template.protein, base: template.base, style: "balanced" });
  }

  function setCount(id: number, count: number) {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, count } : group)));
  }

  // A new combination takes the meals still open, or one meal from the last combination that has more than one.
  const donor = remaining > 0 ? -1 : groups.findLastIndex((group) => group.count > 1);
  const canAddGroup = remaining > 0 || donor >= 0;

  function addGroup() {
    if (!canAddGroup) return;
    setGroups((current) => {
      const take = remaining > 0 ? remaining : 1;
      const next = current.map((group, index) => (index === donor ? { ...group, count: group.count - 1 } : group));
      return [...next, { id: nextGroupId(), slot: defaultSlot(), count: take }];
    });
  }

  function removeGroup(id: number) {
    setGroups((current) => current.filter((group) => group.id !== id));
  }

  function fillAll(templateSlug: string) {
    const template = allowedTemplates.find((row) => row.slug === templateSlug);
    if (!template) return;
    setGroups([
      { id: nextGroupId(), slot: { protein: template.protein, base: template.base, style: "balanced", salsa: "roja" }, count: mealCount },
    ]);
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
          <div>
            <p className="text-sm font-semibold text-ink">Tus {mealCount} comidas</p>
            <p className="mt-0.5 text-[13px] text-muted">Arma una combinación y elige cuántas quieres de cada una.</p>
          </div>
          <label className="flex items-center gap-2 whitespace-nowrap text-[13px] text-muted">
            Llenar todas con
            <select value="" onChange={(event) => fillAll(event.target.value)} className={`${selectClass} w-auto max-w-[16rem]`}>
              <option value="" disabled>
                Elige un platillo
              </option>
              {allowedTemplates.map((template) => (
                <option key={template.slug} value={template.slug}>
                  {withUpgrade(template.name, template.protein)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ol className="mt-4 flex flex-col gap-3">
          {groups.map((group, index) => {
            const { slot } = group;
            const protein = catalog.proteins.find((row) => row.slug === slot.protein);
            const base = catalog.bases.find((row) => row.slug === slot.base);
            const upgrade = upgradeFor(slot.protein);
            const template = slot.style === "balanced" ? findTemplateFor(catalog, slot.protein, slot.base) : undefined;
            const label = `combinación ${index + 1}`;
            return (
              <li key={group.id} className="rounded-frame border border-line-strong bg-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold tracking-tight">
                      {group.count} × {protein && base ? mealName(protein, base, slot.style) : "Platillo"}
                    </p>
                    {upgrade > 0 && (
                      <p className="font-mono text-[12px] text-muted">
                        +{formatCents(upgrade)} c/u · +{formatCents(upgrade * group.count)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <QuantityStepper
                      label={`Cuántas, ${label}`}
                      value={group.count}
                      min={1}
                      max={group.count + remaining}
                      onChange={(count) => setCount(group.id, count)}
                    />
                    {groups.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGroup(group.id)}
                        aria-label={`Quitar ${label}`}
                        className="inline-flex size-9 items-center justify-center rounded-control text-muted transition-colors hover:text-danger"
                      >
                        <Trash weight="bold" className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <select
                    aria-label={`Platillo sugerido, ${label}`}
                    value={template?.slug ?? ""}
                    onChange={(event) => applyTemplate(group.id, event.target.value)}
                    className={`${selectClass} col-span-2 sm:col-span-4`}
                  >
                    <option value="" disabled>
                      Personalizado
                    </option>
                    {allowedTemplates.map((row) => (
                      <option key={row.slug} value={row.slug}>
                        {withUpgrade(row.name, row.protein)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Proteína, ${label}`}
                    value={slot.protein}
                    onChange={(event) => updateGroup(group.id, { protein: event.target.value })}
                    className={selectClass}
                  >
                    {allowedProteins.map((row) => (
                      <option key={row.slug} value={row.slug}>
                        {withUpgrade(row.name, row.slug)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Base, ${label}`}
                    value={slot.base}
                    onChange={(event) => updateGroup(group.id, { base: event.target.value })}
                    className={selectClass}
                  >
                    {catalog.bases.map((row) => (
                      <option key={row.slug} value={row.slug}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Estilo, ${label}`}
                    value={slot.style}
                    disabled={!base?.allowsDoubleCarb}
                    onChange={(event) => updateGroup(group.id, { style: event.target.value as PackageSlot["style"] })}
                    className={`${selectClass} disabled:opacity-50`}
                  >
                    <option value="balanced">{styleLabels.balanced}</option>
                    <option value="double_carb">{styleLabels.double_carb}</option>
                  </select>
                  <select
                    aria-label={`Salsa, ${label}`}
                    value={slot.salsa}
                    onChange={(event) => updateGroup(group.id, { salsa: event.target.value as PackageSlot["salsa"] })}
                    className={selectClass}
                  >
                    <option value="roja">{salsaLabels.roja}</option>
                    <option value="verde">{salsaLabels.verde}</option>
                  </select>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={addGroup} disabled={!canAddGroup} className={`${buttonSecondary} h-10 px-4 text-[14px]`}>
            <Plus weight="bold" className="size-4" aria-hidden />
            Agregar otra combinación
          </button>
          <p aria-live="polite" className={`text-[13px] ${remaining > 0 ? "font-semibold text-danger" : "text-muted"}`}>
            {remaining > 0
              ? `Faltan ${remaining} ${remaining === 1 ? "comida" : "comidas"}`
              : `${filled} de ${mealCount} comidas`}
          </p>
        </div>
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
