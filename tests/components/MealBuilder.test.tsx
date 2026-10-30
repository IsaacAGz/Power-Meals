import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MealBuilder } from "@/components/order/MealBuilder";
import { resolveLine } from "@/lib/catalog/pricing";
import { toCartView } from "@/lib/cart/view";
import { meal, seedCatalog } from "../fixtures/catalog";

const catalog = seedCatalog();

function renderBuilder(props: Partial<Parameters<typeof MealBuilder>[0]> = {}) {
  const onAdd = vi.fn().mockResolvedValue(true);
  const onSetQuantity = vi.fn();
  render(<MealBuilder catalog={catalog} lines={[]} busyKey={null} onAdd={onAdd} onSetQuantity={onSetQuantity} {...props} />);
  return { onAdd, onSetQuantity, user: userEvent.setup() };
}

const confirmButton = () => screen.getByRole("button", { name: /^Confirmar/ }) as HTMLButtonElement;

describe("MealBuilder", () => {
  it("keeps Confirmar disabled until base and protein are chosen", async () => {
    const { user } = renderBuilder();
    expect(confirmButton().disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText("Base"), "arroz");
    expect(confirmButton().disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText("Proteína"), "salmon");
    expect(confirmButton().disabled).toBe(false);
    expect(confirmButton().textContent).toContain("$214");
  });

  it("adds one line at quantity 1 and resets the row", async () => {
    const { user, onAdd } = renderBuilder();
    await user.selectOptions(screen.getByLabelText("Base"), "pasta");
    await user.selectOptions(screen.getByLabelText("Proteína"), "asada");
    await user.click(screen.getByRole("radio", { name: /Plus/ }));
    await user.click(screen.getByRole("radio", { name: /Verde/ }));
    await user.click(confirmButton());

    expect(onAdd).toHaveBeenCalledWith(
      { kind: "meal", source: "builder", meal: { protein: "asada", base: "pasta", size: "plus", style: "balanced", salsa: "verde" } },
      1,
    );
    expect((screen.getByLabelText("Base") as HTMLSelectElement).value).toBe("");
    expect(confirmButton().disabled).toBe(true);
  });

  it("keeps the row when the add fails", async () => {
    const { user } = renderBuilder({ onAdd: vi.fn().mockResolvedValue(false) });
    await user.selectOptions(screen.getByLabelText("Base"), "arroz");
    await user.selectOptions(screen.getByLabelText("Proteína"), "pollo");
    await user.click(confirmButton());
    expect((screen.getByLabelText("Base") as HTMLSelectElement).value).toBe("arroz");
  });

  it("fills the open row from a suggested plate without adding it", async () => {
    const { user, onAdd } = renderBuilder();
    await user.click(screen.getByRole("button", { name: /Pollo \+ camote \+ veggies/ }));
    expect(onAdd).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Base") as HTMLSelectElement).value).toBe("camote");
    expect((screen.getByLabelText("Proteína") as HTMLSelectElement).value).toBe("pollo");

    await user.click(confirmButton());
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ source: "template", template: "pollo-camote" }), 1);
  });

  it("disables doble carb on a salad", async () => {
    const { user } = renderBuilder();
    await user.selectOptions(screen.getByLabelText("Base"), "ensalada");
    expect((screen.getByRole("radio", { name: /Doble carb/ }) as HTMLInputElement).disabled).toBe(true);
  });

  it("changes quantity and removes a confirmed plate", async () => {
    const lines = toCartView([resolveLine(catalog, meal(), 2)!]).lines;
    const { user, onSetQuantity } = renderBuilder({ lines });
    await user.click(screen.getByRole("button", { name: /Quitar Pollo \+ arroz/ }));
    expect(onSetQuantity).toHaveBeenCalledWith(lines[0].key, lines[0].item, 0);
  });
});
