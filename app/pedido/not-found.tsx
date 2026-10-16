import Link from "next/link";
import { buttonPrimary, container } from "@/lib/ui";

export default function PedidoNotFound() {
  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={container}>
        <div className="mx-auto max-w-[760px]">
          <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">
            Pedido no encontrado
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Revisa que el enlace esté completo. Si acabas de pagar, abre el enlace del correo de confirmación.
          </p>
          <Link href="/pedido" className={`${buttonPrimary} mt-8`}>
            Hacer un pedido
          </Link>
        </div>
      </div>
    </section>
  );
}
