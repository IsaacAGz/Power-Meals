import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requireKitchenStaff } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { container } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Panel de cocina",
  robots: { index: false },
};

export default async function KitchenDashboardPage() {
  const user = await requireKitchenStaff("/kitchen/dashboard");

  const [facility] = await getDb()
    .select({ name: schema.kitchenFacilities.name })
    .from(schema.kitchenFacilities)
    .where(eq(schema.kitchenFacilities.id, user.kitchenFacilityId))
    .limit(1);

  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={container}>
        <p className="text-[15px] font-semibold text-muted">Cocina {facility?.name}</p>
        <h1 className="mt-2 font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">
          Panel de cocina
        </h1>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted">
          Aquí aparecerán los pedidos pagados de esta cocina.
        </p>
      </div>
    </section>
  );
}
