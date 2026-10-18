"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CaretDown, CircleNotch, Trash } from "@phosphor-icons/react";
import { findTemplateFor, resolveMeal } from "@/lib/catalog/pricing";
import {
  portionLabels,
  styleLabels,
  type CartItem,
  type Catalog,
  type MealSelection,
  type MealTemplate,
  type PlateStyle,
  type PortionSize,
  type Salsa,
} from "@/lib/catalog/types";
import type { CartLineView } from "@/lib/cart/view";
import { formatCents } from "@/lib/format";
import { buttonPrimary, inputClass, textLink } from "@/lib/ui";
import { FormField } from "../FormField";
import { ChoiceGroup, QuantityStepper } from "./ChoiceGroup";

type OpenRow = {
  base: string;
  protein: string;
  size: PortionSize | "";
  style: PlateStyle | "";
  salsa: Salsa | "";
};

const emptyRow = (): OpenRow => ({ base: "", protein: "", size: "regular", style: "balanced", salsa: "roja" });

function rowFromTemplate(template: MealTemplate): OpenRow {
  return { protein: template.protein, base: template.base, size: "regular", style: "balanced", salsa: "roja" };
}

function toSelection(row: OpenRow): MealSelection | null {
  if (!row.protein || !row.base || !row.size || !row.style || !row.salsa) return null;
  return { protein: row.protein, base: row.base, size: row.size, style: row.style, salsa: row.salsa };
}

export function MealBuilder({
  catalog,
  initialTemplate,
  lines,
  busyKey,
  onAdd,
  onSetQuantity,
}: {
  catalog: Catalog;
  initialTemplate?: string;
  lines: CartLineView[];
  busyKey: string | null;
  onAdd: (item: CartItem, quantity: number) => Promise<boolean>;
  onSetQuantity: (key: string, item: CartItem, quantity: number) => void;
}) {
  const start = catalog.templates.find((template) => template.slug === initialTemplate);
  const [row, setRow] = useState<OpenRow>(() => (start ? rowFromTemplate(start) : emptyRow()));
  const [pending, setPending] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const templateListRef = useRef<HTMLUListElement>(null);
  const [templateClip, setTemplateClip] = useState<{ collapsed: number; full: number } | null>(null);

  const selection = toSelection(row);
  const meal = selection ? resolveMeal(catalog, selection) : null;
  const base = catalog.bases.find((item) => item.slug === row.base);

  function update(patch: Partial<OpenRow>) {
    setRow((current) => {
      const next = { ...current, ...patch };
      const nextBase = catalog.bases.find((item) => item.slug === next.base);
      if (next.style === "double_carb" && !nextBase?.allowsDoubleCarb) next.style = "balanced";
      return next;
    });
  }

  async function confirm() {
    if (!selection || !meal) return;
    const template = row.style === "balanced" ? findTemplateFor(catalog, row.protein, row.base) : undefined;
    const item: CartItem = template
      ? { kind: "meal", source: "template", template: template.slug, meal: selection }
      : { kind: "meal", source: "builder", meal: selection };
    setPending(true);
    if (await onAdd(item, 1)) setRow(emptyRow());
    setPending(false);
  }

  const basicTemplates = catalog.templates.filter((template) => template.protein === "pollo");
  const featured = basicTemplates.length > 0 ? basicTemplates : catalog.templates.slice(0, 4);
  const featuredSlugs = new Set(featured.map((template) => template.slug));
  const hiddenCount = catalog.templates.length - featured.length;

  useLayoutEffect(() => {
    const list = templateListRef.current;
    if (!list || hiddenCount === 0) return;

    const measure = () => {
      const nodes = [...list.querySelectorAll<HTMLElement>("[data-basic]")];
      const last = nodes.at(-1);
      const full = list.scrollHeight;
      const collapsed = last ? Math.min(full, last.offsetTop + last.offsetHeight + 36) : full;
      setTemplateClip((current) =>
        current && current.collapsed === collapsed && current.full === full ? current : { collapsed, full },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const item of list.children) observer.observe(item);
    return () => observer.disconnect();
  }, [hiddenCount, catalog.templates]);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <ul className="flex flex-col gap-3">
        {lines.map((line) => (
          <li key={line.key} className="rounded-frame border border-line-strong bg-paper p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold tracking-tight">{line.displayName}</p>
                <p className="mt-1 text-[13px] text-muted">{line.detail}</p>
              </div>
              <div className="flex items-center gap-3">
                <QuantityStepper
                  value={line.quantity}
                  onChange={(quantity) => onSetQuantity(line.key, line.item, quantity)}
                  disabled={busyKey === line.key}
                  label={line.displayName}
                />
                <button
                  type="button"
                  onClick={() => onSetQuantity(line.key, line.item, 0)}
                  disabled={busyKey === line.key}
                  aria-label={`Quitar ${line.displayName}`}
                  className="inline-flex size-9 items-center justify-center rounded-control text-muted transition-colors hover:text-ink disabled:opacity-35"
                >
                  <Trash weight="bold" className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
        <li className="min-w-0 rounded-frame border border-ink bg-paper p-4 sm:p-5">
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            <FormField label="Base">
              {(props) => (
                <div className="relative">
                  <select
                    {...props}
                    value={row.base}
                    onChange={(event) => update({ base: event.target.value })}
                    className={`${inputClass(false)} appearance-none pr-10`}
                  >
                    <option value="">Elige una base</option>
                    {catalog.bases.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <CaretDown weight="bold" aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2" />
                </div>
              )}
            </FormField>
            <FormField label="Proteína">
              {(props) => (
                <div className="relative">
                  <select
                    {...props}
                    value={row.protein}
                    onChange={(event) => update({ protein: event.target.value })}
                    className={`${inputClass(false)} appearance-none pr-10`}
                  >
                    <option value="">Elige una proteína</option>
                    {catalog.proteins.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <CaretDown weight="bold" aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2" />
                </div>
              )}
            </FormField>
          </div>
          <div className="mt-6 grid min-w-0 gap-6 md:grid-cols-3">
            <ChoiceGroup
              legend="Tamaño"
              value={row.size}
              onChange={(size) => update({ size })}
              className="grid-cols-2"
              options={catalog.portions.map((portion) => ({
                value: portion.size,
                label: portionLabels[portion.size],
                hint: `${portion.proteinGrams} g`,
              }))}
            />
            <ChoiceGroup
              legend="Estilo"
              value={row.style}
              onChange={(style) => update({ style })}
              className="grid-cols-2"
              options={[
                { value: "balanced" as const, label: styleLabels.balanced, hint: base?.includesVeggies ? "con veggies" : undefined },
                {
                  value: "double_carb" as const,
                  label: styleLabels.double_carb,
                  hint: "sin veggies",
                  disabled: !base?.allowsDoubleCarb,
                },
              ]}
            />
            <ChoiceGroup
              legend="Salsa"
              value={row.salsa}
              onChange={(salsa) => update({ salsa })}
              className="grid-cols-2"
              options={[
                { value: "roja" as const, label: "Roja" },
                { value: "verde" as const, label: "Verde" },
              ]}
            />
          </div>
          {meal && (
            <p className="mt-5 text-[13px] text-muted">
              {meal.proteinGrams} g {meal.protein.name.toLowerCase()}
              {meal.carbGrams > 0 && ` · ${meal.carbGrams} g ${meal.base.name.toLowerCase()}`}
              {meal.vegGrams > 0 && ` · ${meal.vegGrams} g vegetales`}
              {` · ${meal.salsaNote.toLowerCase()}`}
            </p>
          )}
          <button type="button" onClick={confirm} disabled={!meal || pending} className={`${buttonPrimary} mt-5 w-full sm:w-auto`}>
            {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
            Confirmar{meal ? ` · ${formatCents(meal.unitPriceCents)}` : ""}
          </button>
        </li>
      </ul>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm font-semibold text-ink">Platillos sugeridos</p>
          {hiddenCount > 0 && (
            <button
              type="button"
              aria-expanded={showAllTemplates}
              onClick={() => setShowAllTemplates((open) => !open)}
              className={textLink}
            >
              {showAllTemplates ? "Ver menos" : "Ver más platillos"}
            </button>
          )}
        </div>
        <ul
          ref={templateListRef}
          className="relative mt-3 flex min-w-0 flex-wrap gap-2 overflow-hidden transition-[max-height] duration-500 ease-out-expo motion-reduce:transition-none"
          style={
            templateClip ? { maxHeight: showAllTemplates ? templateClip.full : templateClip.collapsed } : undefined
          }
        >
            {catalog.templates.map((template) => {
              const preview = resolveMeal(catalog, {
                protein: template.protein,
                base: template.base,
                size: "regular",
                style: "balanced",
                salsa: "roja",
              });
              const selected = row.protein === template.protein && row.base === template.base;
              const basic = featuredSlugs.has(template.slug);
              const concealed = !showAllTemplates && !basic;
              return (
                <li key={template.slug} data-basic={basic ? "" : undefined} inert={concealed} className="max-w-full">
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-hidden={concealed || undefined}
                    tabIndex={concealed ? -1 : undefined}
                    onClick={() => setRow(rowFromTemplate(template))}
                    className={`flex h-auto min-h-10 max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-control border px-3 py-2 text-left text-[14px] font-semibold transition-colors ${
                      selected ? "border-ink bg-ink text-cream" : "border-line-strong bg-paper text-ink hover:border-ink"
                    }`}
                  >
                    {template.name}
                    {preview && (
                      <span className={`font-mono text-[12px] ${selected ? "text-cream/70" : "text-muted"}`}>
                        {formatCents(preview.unitPriceCents)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          {hiddenCount > 0 && (
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-cream from-20% to-transparent transition-opacity duration-500 ease-out-expo motion-reduce:transition-none ${
                showAllTemplates ? "opacity-0" : "opacity-100"
              }`}
            />
          )}
        </ul>
      </div>
    </div>
  );
}
