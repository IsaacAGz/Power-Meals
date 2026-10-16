"use client";

import { useState } from "react";
import { CircleNotch, Plus } from "@phosphor-icons/react";
import { findTemplateFor, resolveMeal } from "@/lib/catalog/pricing";
import {
  portionLabels,
  styleLabels,
  type CartItem,
  type Catalog,
  type MealSelection,
  type MealTemplate,
} from "@/lib/catalog/types";
import { formatCents } from "@/lib/format";
import { buttonPrimary } from "@/lib/ui";
import { ChoiceGroup, QuantityStepper } from "./ChoiceGroup";

function selectionFrom(template: MealTemplate | undefined, catalog: Catalog): MealSelection {
  return {
    protein: template?.protein ?? catalog.proteins[0]?.slug ?? "",
    base: template?.base ?? catalog.bases[0]?.slug ?? "",
    size: "regular",
    style: "balanced",
    salsa: "roja",
  };
}

export function MealBuilder({
  catalog,
  initialTemplate,
  onAdd,
}: {
  catalog: Catalog;
  initialTemplate?: string;
  onAdd: (item: CartItem, quantity: number) => Promise<boolean>;
}) {
  const start = catalog.templates.find((template) => template.slug === initialTemplate);
  const [selection, setSelection] = useState<MealSelection>(() => selectionFrom(start, catalog));
  const [pickedTemplate, setPickedTemplate] = useState<string | null>(start?.slug ?? null);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);

  const base = catalog.bases.find((row) => row.slug === selection.base);
  const meal = resolveMeal(catalog, selection);
  const matchingTemplate = findTemplateFor(catalog, selection.protein, selection.base);

  function update(patch: Partial<MealSelection>) {
    setSelection((current) => {
      const next = { ...current, ...patch };
      const nextBase = catalog.bases.find((row) => row.slug === next.base);
      if (!nextBase?.allowsDoubleCarb) next.style = "balanced";
      return next;
    });
  }

  function pickTemplate(template: MealTemplate) {
    setPickedTemplate(template.slug);
    update({ protein: template.protein, base: template.base, style: "balanced" });
  }

  async function add() {
    if (!meal) return;
    const fromTemplate =
      pickedTemplate !== null && matchingTemplate?.slug === pickedTemplate && selection.style === "balanced";
    const item: CartItem = fromTemplate
      ? { kind: "meal", source: "template", template: pickedTemplate, meal: selection }
      : { kind: "meal", source: "builder", meal: selection };
    setPending(true);
    if (await onAdd(item, quantity)) setQuantity(1);
    setPending(false);
  }

  const activeTemplate = selection.style === "balanced" ? matchingTemplate?.slug : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-semibold text-ink">Platillos sugeridos</p>
        <ul className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {catalog.templates.map((template) => {
            const preview = resolveMeal(catalog, { ...selection, protein: template.protein, base: template.base, style: "balanced" });
            const selected = activeTemplate === template.slug;
            return (
              <li key={template.slug} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickTemplate(template)}
                  className={`flex h-10 items-center gap-2 rounded-control border px-3 text-[14px] font-semibold transition-colors ${
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
        </ul>
      </div>

      <ChoiceGroup
        legend="Proteína"
        value={selection.protein}
        onChange={(protein) => update({ protein })}
        className="grid-cols-2 sm:grid-cols-4"
        options={catalog.proteins.map((protein) => {
          const upgrade = protein.upgradeCents[selection.size];
          return { value: protein.slug, label: protein.name, hint: upgrade > 0 ? `+${formatCents(upgrade)}` : "Base" };
        })}
      />

      <ChoiceGroup
        legend="Base"
        value={selection.base}
        onChange={(slug) => update({ base: slug })}
        className="grid-cols-2 sm:grid-cols-5"
        options={catalog.bases.map((row) => ({ value: row.slug, label: row.name }))}
      />

      <div className="grid gap-8 sm:grid-cols-3">
        <ChoiceGroup
          legend="Tamaño"
          value={selection.size}
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
          value={selection.style}
          onChange={(style) => update({ style })}
          className="grid-cols-2"
          options={[
            { value: "balanced", label: styleLabels.balanced, hint: base?.includesVeggies ? "con veggies" : undefined },
            { value: "double_carb", label: styleLabels.double_carb, hint: "sin veggies", disabled: !base?.allowsDoubleCarb },
          ]}
        />
        <ChoiceGroup
          legend="Salsa (1 oz)"
          value={selection.salsa}
          onChange={(salsa) => update({ salsa })}
          className="grid-cols-2"
          options={[
            { value: "roja", label: "Roja" },
            { value: "verde", label: "Verde" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-5 rounded-frame border border-ink bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold tracking-tight">
            {meal ? `${meal.name} · ${meal.portion.label}` : "Elige una combinación"}
          </p>
          {meal && (
            <p className="mt-1 text-[13px] text-muted">
              {meal.proteinGrams} g {meal.protein.name.toLowerCase()}
              {meal.carbGrams > 0 && ` · ${meal.carbGrams} g ${meal.base.name.toLowerCase()}`}
              {meal.vegGrams > 0 && ` · ${meal.vegGrams} g vegetales`}
              {` · ${meal.salsaNote.toLowerCase()}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <QuantityStepper value={quantity} onChange={setQuantity} label="Cantidad" />
          <button type="button" onClick={add} disabled={!meal || pending} className={`${buttonPrimary} min-w-[170px]`}>
            {pending ? (
              <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />
            ) : (
              <Plus weight="bold" className="size-4" aria-hidden />
            )}
            Agregar {meal ? formatCents(meal.unitPriceCents * quantity) : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
