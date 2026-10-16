import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { MealPackage } from "@/lib/catalog/types";
import { formatCents } from "@/lib/format";
import { buttonPrimary } from "@/lib/ui";

/** POWER Chicken / POWER Mix price grids; each price deep-links to /pedido with the variant preselected. */
export function PackageCards({ packages }: { packages: MealPackage[] }) {
  const products = [...new Set(packages.map((pkg) => pkg.productSlug))].map((slug) =>
    packages.filter((pkg) => pkg.productSlug === slug),
  );

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {products.map((variants) => {
        const first = variants[0];
        const counts = [...new Set(variants.map((pkg) => pkg.mealCount))];
        return (
          <li key={first.productSlug} className="flex flex-col rounded-frame border border-line-strong bg-paper p-6 sm:p-8">
            <h3 className="font-display text-3xl font-extrabold tracking-tight">{first.name}</h3>
            <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed text-muted">{first.description}</p>
            <table className="mt-6 w-full text-left">
              <thead>
                <tr className="text-sm text-muted">
                  <th scope="col" className="pb-2 font-medium">
                    Comidas
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Regular
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Plus
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {counts.map((count) => (
                  <tr key={count}>
                    <th scope="row" className="py-2.5 font-mono text-[15px] font-medium">
                      {count}
                    </th>
                    {(["regular", "plus"] as const).map((size) => {
                      const pkg = variants.find((row) => row.mealCount === count && row.size === size);
                      return (
                        <td key={size} className="py-2.5">
                          {pkg && (
                            <Link
                              href={`/pedido?paquete=${pkg.slug}`}
                              className="font-mono text-[15px] tabular-nums underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                            >
                              {formatCents(pkg.priceCents)}
                            </Link>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <Link href={`/pedido?paquete=${first.productSlug}`} className={`${buttonPrimary} mt-8 w-fit`}>
              Armar {first.name}
              <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
