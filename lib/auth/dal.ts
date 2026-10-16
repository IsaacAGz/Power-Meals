import "server-only";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { getSession } from "@/lib/session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: (typeof schema.userRole.enumValues)[number];
  kitchenFacilityId: string | null;
};

/** The role always comes from the database, so a demotion takes effect on the next request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session?.data.userId) return null;

  const [user] = await getDb()
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
      role: schema.users.role,
      kitchenFacilityId: schema.users.kitchenFacilityId,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.data.userId))
    .limit(1);
  return user ?? null;
});

export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireKitchenStaff(returnTo: string): Promise<CurrentUser & { kitchenFacilityId: string }> {
  const user = await requireUser(returnTo);
  if (user.role !== "kitchen_staff" || !user.kitchenFacilityId) notFound();
  return { ...user, kitchenFacilityId: user.kitchenFacilityId };
}

export function homeFor(user: Pick<CurrentUser, "role">): string {
  return user.role === "kitchen_staff" ? "/kitchen/dashboard" : "/cuenta";
}
