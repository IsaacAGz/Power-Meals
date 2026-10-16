const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatMXN(pesos: number) {
  return mxn.format(pesos);
}

export function formatCents(cents: number) {
  return mxn.format(cents / 100);
}

/** ["A", "B", "A"] -> ["2× A", "B"], keeping first-seen order. */
export function groupNames(names: string[]) {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${count}× ${name}` : name));
}
