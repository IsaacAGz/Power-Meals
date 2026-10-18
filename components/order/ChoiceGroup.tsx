"use client";

import { useId } from "react";
import { Minus, Plus } from "@phosphor-icons/react";

/** `hint` is a price or count (monospace); `note` is a sentence of description. */
export type Choice<T extends string> = { value: T; label: string; hint?: string; note?: string; disabled?: boolean };

export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  className = "grid-cols-2 sm:grid-cols-3",
}: {
  legend: string;
  options: Choice<T>[];
  value: T | "";
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-ink">{legend}</legend>
      <div className={`grid gap-2 ${className}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-control border px-3 py-2 text-center transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                selected ? "border-ink bg-ink text-cream" : "border-line-strong bg-paper text-ink hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="text-[15px] leading-tight font-semibold">{option.label}</span>
              {option.hint && (
                <span className={`mt-0.5 font-mono text-[12px] ${selected ? "text-cream/70" : "text-muted"}`}>{option.hint}</span>
              )}
              {option.note && (
                <span className={`mt-1 text-[13px] leading-snug ${selected ? "text-cream/75" : "text-muted"}`}>{option.note}</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  disabled?: boolean;
}) {
  const button =
    "inline-flex size-9 items-center justify-center rounded-control transition-transform active:scale-[0.94] disabled:opacity-35";
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Quitar uno: ${label}`}
        className={`${button} border border-line-strong text-ink`}
      >
        <Minus weight="bold" className="size-4" />
      </button>
      <span className="w-7 text-center font-mono text-[15px] tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Agregar uno: ${label}`}
        className={`${button} bg-ink text-cream`}
      >
        <Plus weight="bold" className="size-4" />
      </button>
    </div>
  );
}
