import type { Metadata } from "next";
import { KitchenBoard } from "@/components/kitchen/KitchenBoard";
import { requireKitchenStaff } from "@/lib/auth/dal";
import { getKitchenBoard } from "@/lib/kitchen/orders";
import { container } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Pedidos de cocina",
  robots: { index: false },
};

export default async function KitchenDashboardPage() {
  const user = await requireKitchenStaff("/kitchen/dashboard");
  const board = await getKitchenBoard(user.kitchenFacilityId);

  return (
    <section className="pt-8 pb-16 md:pt-12 md:pb-24">
      <div className={container}>
        <KitchenBoard initial={board} />
      </div>
    </section>
  );
}
