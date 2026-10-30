import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutForm } from "@/components/order/CheckoutForm";
import { resolveLine } from "@/lib/catalog/pricing";
import { emptyCartView, toCartView } from "@/lib/cart/view";
import { meal, seedCatalog } from "../fixtures/catalog";

const points = [
  { slug: "otay", name: "Otay", address: "" },
  { slug: "zona-rio", name: "Zona Río", address: "" },
];

function renderForm(cart = toCartView([resolveLine(seedCatalog(), meal(), 2)!])) {
  render(
    <CheckoutForm
      cart={cart}
      zones={[]}
      points={points}
      prefill={{ name: "", email: "", phone: "" }}
      openpayEnabled={false}
      signedIn={false}
    />,
  );
  return userEvent.setup();
}

const submit = () => screen.getByRole("button", { name: "Enviar pedido por WhatsApp" });

afterEach(() => vi.unstubAllGlobals());

describe("CheckoutForm", () => {
  it("offers pickup only, with delivery visible and disabled", () => {
    renderForm();
    expect((screen.getByRole("radio", { name: "Entrega a domicilio" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: "Recolección" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("La entrega a domicilio no está disponible por ahora.")).toBeTruthy();
  });

  it("shows field errors and sends nothing when the form is incomplete", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = renderForm();
    await user.click(submit());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Escribe tu nombre.")).toBeTruthy();
    expect(screen.getByText("Elige un punto de recolección.")).toBeTruthy();
  });

  it("refuses an empty cart", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = renderForm(emptyCartView());
    await user.click(submit());
    expect(screen.getByText("Agrega al menos un platillo a tu pedido.")).toBeTruthy();
  });

  it("stores the order, then opens WhatsApp with the written order", async () => {
    const popup = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.stubGlobal("open", vi.fn().mockReturnValue(popup));
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, saved: false }));
    vi.stubGlobal("fetch", fetchMock);

    const user = renderForm();
    await user.type(screen.getByLabelText("Nombre"), "Mariana López");
    await user.type(screen.getByLabelText("Teléfono"), "664 123 4567");
    await user.selectOptions(screen.getByLabelText("Punto de recolección"), "otay");
    await user.click(submit());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders/whatsapp");
    expect(JSON.parse(init.body)).toMatchObject({ nombre: "Mariana López", metodo: "recoleccion", punto: "otay" });
    expect(popup.opener).toBeNull();
    const text = decodeURIComponent(new URL(popup.location.href).searchParams.get("text") ?? "");
    expect(popup.location.href).toMatch(/^https:\/\/wa\.me\/16196001137/);
    expect(text).toContain("Punto: Otay");
    expect(text).toContain("2 x Pollo + arroz + veggies · Regular");
  });

  it("closes the blank tab and shows the server's field errors", async () => {
    const popup = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.stubGlobal("open", vi.fn().mockReturnValue(popup));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: false, errors: { punto: "Elige un punto disponible." } })));

    const user = renderForm();
    await user.type(screen.getByLabelText("Nombre"), "Mariana López");
    await user.type(screen.getByLabelText("Teléfono"), "664 123 4567");
    await user.selectOptions(screen.getByLabelText("Punto de recolección"), "otay");
    await user.click(submit());

    expect(popup.close).toHaveBeenCalled();
    expect(await screen.findByText("Elige un punto disponible.")).toBeTruthy();
  });
});
