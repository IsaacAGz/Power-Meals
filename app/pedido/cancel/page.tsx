import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowCounterClockwise, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { ReceiptSummary } from "@/components/order/ReceiptSummary";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { getPublicReceipt } from "@/lib/orders/public-receipt";
import { isPublicOrderRef, receiptPath } from "@/lib/orders/ref";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/request";
import { TooManyRequests } from "@/components/order/TooManyRequests";
import { buttonPrimary, container, textLink } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Pago no completado",
  robots: { index: false },
};

export default async function PedidoCancelPage({ searchParams }: PageProps<"/pedido/cancel">) {
  const { order_ref: ref } = await searchParams;
  if (!isPublicOrderRef(ref)) notFound();

  const limit = await hitRateLimit(`receipt:ip:${clientIpFromHeaders(await headers())}`, 60, 60);
  if (!limit.allowed) return <TooManyRequests />;

  const receipt = await getPublicReceipt(ref);
  if (!receipt) notFound();
  if (receipt.status === "paid" || receipt.status === "whatsapp") redirect(receiptPath(ref));

  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={container}>
        <div className="mx-auto flex max-w-[760px] flex-col gap-10">
          <header>
            <WarningCircle weight="bold" className="size-10 text-[#B42318]" aria-hidden />
            <h1 className="mt-5 font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">
              Tu pago no se completó
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              No se hizo ningún cargo por el pedido <span className="font-mono text-ink">#{receipt.orderNumber}</span>. Tus
              platillos siguen en tu pedido para intentarlo de nuevo.
            </p>
            {receipt.status === "pending" && (
              <p className="mt-3 text-[15px] text-muted">
                ¿Ya pagaste?{" "}
                <Link href={receiptPath(ref)} className={textLink}>
                  Revisa el estado de tu pago
                </Link>
              </p>
            )}
          </header>

          <div className="flex flex-wrap gap-3">
            <Link href="/pedido" className={buttonPrimary}>
              <ArrowCounterClockwise weight="bold" className="size-4" aria-hidden />
              Volver a intentar
            </Link>
            <WhatsAppButton
              message={`Hola Power Meals, no pude completar el pago del pedido #${receipt.orderNumber}.`}
              label="Pedir ayuda por WhatsApp"
            />
          </div>

          <ReceiptSummary receipt={receipt} />
        </div>
      </div>
    </section>
  );
}
