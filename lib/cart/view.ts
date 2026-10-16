import type { ResolvedLine } from "@/lib/catalog/pricing";
import type { CartItem } from "@/lib/catalog/types";

export type CartLineView = {
  key: string;
  item: CartItem;
  quantity: number;
  displayName: string;
  detail: string;
  unitPriceCents: number;
  lineTotalCents: number;
  /** Package contents, one name per meal. */
  slotNames: string[];
};

export type CartView = { lines: CartLineView[]; totalCents: number; mealCount: number };

export const emptyCartView = (): CartView => ({ lines: [], totalCents: 0, mealCount: 0 });

export function toCartView(lines: ResolvedLine[]): CartView {
  return {
    lines: lines.map((line) => ({
      key: line.key,
      item: line.item,
      quantity: line.quantity,
      displayName: line.displayName,
      detail: line.detail,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      slotNames: line.package ? line.meals.map((meal) => meal.name) : [],
    })),
    totalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    mealCount: lines.reduce((sum, line) => sum + line.quantity * line.meals.length, 0),
  };
}
