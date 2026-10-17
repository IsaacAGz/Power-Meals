"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireKitchenStaff } from "@/lib/auth/dal";
import { sendKitchenTicket } from "./dispatch";
import { advanceKitchenOrderStatus, type TransitionResult } from "./transition";
import { KITCHEN_STATUSES, type KitchenStatus } from "./types";

function isKitchenStatus(value: string): value is KitchenStatus {
  return (KITCHEN_STATUSES as readonly string[]).includes(value);
}

export async function advanceKitchenOrder(orderId: string, fromStatus: string): Promise<TransitionResult> {
  const user = await requireKitchenStaff("/kitchen/dashboard");
  if (!isKitchenStatus(fromStatus)) return { ok: false, message: "Ese cambio no está permitido." };

  const result = await advanceKitchenOrderStatus(user.kitchenFacilityId, user.id, orderId, fromStatus);
  if (!result.ok) return result;

  if (result.becamePaid) after(() => sendKitchenTicket(orderId));
  revalidatePath("/kitchen/dashboard");
  revalidatePath("/historial");
  return { ok: true, status: result.status };
}
