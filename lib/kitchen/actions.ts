"use server";

import { revalidatePath } from "next/cache";
import { requireKitchenStaff } from "@/lib/auth/dal";
import { advanceKitchenOrderStatus, type TransitionResult } from "./transition";
import { KITCHEN_STATUSES, type KitchenStatus } from "./types";

function isKitchenStatus(value: string): value is KitchenStatus {
  return (KITCHEN_STATUSES as readonly string[]).includes(value);
}

export async function advanceKitchenOrder(orderId: string, fromStatus: string): Promise<TransitionResult> {
  const user = await requireKitchenStaff("/kitchen/dashboard");
  if (!isKitchenStatus(fromStatus)) return { ok: false, message: "Ese cambio no está permitido." };

  const result = await advanceKitchenOrderStatus(user.kitchenFacilityId, user.id, orderId, fromStatus);
  if (result.ok) {
    revalidatePath("/kitchen/dashboard");
    revalidatePath("/historial");
  }
  return result;
}
