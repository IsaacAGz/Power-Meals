import { formatCents, groupNames } from "@/lib/format";
import type { PublicReceipt } from "@/lib/orders/public-receipt";

export function ReceiptSummary({ receipt }: { receipt: PublicReceipt }) {
  const { fulfillment } = receipt;
  return (
    <div className="rounded-frame border border-line-strong bg-paper">
      <ul className="divide-y divide-line">
        {receipt.lines.map((line, index) => (
          <li key={index} className="flex items-start justify-between gap-4 px-6 py-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">
                {line.quantity}× {line.displayName}
              </p>
              {line.slots.length > 0 && <p className="mt-1 text-[13px] leading-relaxed text-muted">{groupNames(line.slots).join(" · ")}</p>}
            </div>
            <span className="shrink-0 font-mono text-[15px] tabular-nums">{formatCents(line.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-line-strong px-6 py-4">
        <span className="text-sm text-muted">Total</span>
        <span className="font-mono text-xl font-medium tabular-nums">
          {formatCents(receipt.totalCents)} <span className="text-sm text-muted">MXN</span>
        </span>
      </div>
      <dl className="grid gap-4 border-t border-line px-6 py-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">{fulfillment.type === "delivery" ? "Entrega a domicilio" : "Recolección"}</dt>
          <dd className="mt-1 text-[15px] font-medium">
            {fulfillment.place}
            {fulfillment.address && <span className="block font-normal text-muted">{fulfillment.address}</span>}
          </dd>
        </div>
        {fulfillment.schedule && (
          <div>
            <dt className="text-sm text-muted">{fulfillment.type === "delivery" ? "Días de entrega" : "Horario"}</dt>
            <dd className="mt-1 text-[15px] font-medium">{fulfillment.schedule}</dd>
          </div>
        )}
        {receipt.notes && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted">Notas</dt>
            <dd className="mt-1 text-[15px]">{receipt.notes}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
