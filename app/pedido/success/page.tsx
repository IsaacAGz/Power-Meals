import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { LinkOrderPanel } from "@/components/order/LinkOrderPanel";
import { OrderStatusTracker } from "@/components/order/OrderStatusTracker";
import { ReceiptSummary } from "@/components/order/ReceiptSummary";
import { TooManyRequests } from "@/components/order/TooManyRequests";
import { getCurrentUser } from "@/lib/auth/dal";
import { issueLinkToken } from "@/lib/orders/link";
import { getPublicReceipt } from "@/lib/orders/public-receipt";
import { isSettledPublicStatus, receiptLead } from "@/lib/orders/public-status";
import { isPublicOrderRef, receiptPath } from "@/lib/orders/ref";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/request";
import { buttonPrimary, buttonSecondary, container, textLink } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false },
};

/**
 * Openpay sends the customer back here with a cross-site navigation, so pm_session (SameSite=Strict) is absent
 * on first load. Everything renders from the order_ref; the session only adds the "save to my account" shortcut.
 */
export default async function PedidoSuccessPage({ searchParams }: PageProps<"/pedido/success">) {
  const { order_ref: ref } = await searchParams;
  if (!isPublicOrderRef(ref)) notFound();

  const limit = await hitRateLimit(`receipt:ip:${clientIpFromHeaders(await headers())}`, 60, 60);
  if (!limit.allowed) return <TooManyRequests />;

  const receipt = await getPublicReceipt(ref);
  if (!receipt) notFound();
  if (receipt.status === "failed") redirect(receiptPath(ref, "cancel"));

  const settled = isSettledPublicStatus(receipt.status);
  const pending = receipt.status === "pending";
  const user = await getCurrentUser();
  const ownedByViewer = user !== null && receipt.ownerUserId === user.id;
  const isGuestOrder = receipt.ownerUserId === null;
  const emailMatches = user !== null && user.email.toLowerCase() === receipt.customerEmail.toLowerCase();
  const linkToken = settled && isGuestOrder && (!user || emailMatches) ? await issueLinkToken(ref) : null;
  const lead = receiptLead(receipt.status, receipt.customerName.split(" ")[0] ?? "");

  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={container}>
        <div className="mx-auto flex max-w-[760px] flex-col gap-10">
          <header>
            {!pending && <CheckCircle weight="bold" className="size-10 text-ink" aria-hidden />}
            <h1 className="mt-5 font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">
              {lead.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              Pedido <span className="font-mono text-ink">#{receipt.orderNumber}</span>. {lead.detail}
            </p>
          </header>

          <OrderStatusTracker
            orderRef={ref}
            status={receipt.status}
            origin={receipt.origin}
            cancelPath={receiptPath(ref, "cancel")}
          />

          <ReceiptSummary receipt={receipt} />

          {linkToken && (
            <LinkOrderPanel
              mode={user ? "confirm" : "register"}
              orderRef={ref}
              token={linkToken}
              name={receipt.customerName}
              email={receipt.customerEmail}
              loginHref={`/ingresar?next=${encodeURIComponent(receiptPath(ref))}`}
            />
          )}

          {settled && isGuestOrder && user && !emailMatches && (
            <p className="text-[15px] text-muted">
              Este pedido se hizo con otro correo, así que no podemos guardarlo en tu cuenta.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {ownedByViewer ? (
              <Link href="/historial" className={buttonPrimary}>
                Ver mis pedidos
                <ArrowRight weight="bold" className="size-4" />
              </Link>
            ) : (
              <Link href="/menu" className={buttonSecondary}>
                Ver menú
              </Link>
            )}
            {pending && (
              <p className="self-center text-[15px] text-muted">
                ¿Problemas con el pago?{" "}
                <Link href="/pedido" className={textLink}>
                  Volver al pedido
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
