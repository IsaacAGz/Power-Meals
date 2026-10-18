import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth/password";
import { normalizeEmail, PASSWORD_MIN_LENGTH } from "../lib/auth/validation";
import { getDb, getPool, schema } from "../lib/db";

const usage = `Usage: STAFF_PASSWORD=... npm run user:create-staff -- --email <email> --name <name> --facility <slug>

Reads the password from STAFF_PASSWORD so it never appears in argv or shell history
(set it with: read -rs STAFF_PASSWORD && export STAFF_PASSWORD).`;

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" }, facility: { type: "string" } },
  });
  const email = normalizeEmail(values.email);
  const name = values.name?.trim();
  const password = process.env.STAFF_PASSWORD ?? "";

  if (!email || !name || !values.facility) throw new Error(usage);
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`STAFF_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.\n\n${usage}`);
  }

  const db = getDb();
  const [facility] = await db
    .select({ id: schema.kitchenFacilities.id, name: schema.kitchenFacilities.name })
    .from(schema.kitchenFacilities)
    .where(eq(schema.kitchenFacilities.slug, values.facility))
    .limit(1);
  if (!facility) throw new Error(`No kitchen facility with slug "${values.facility}". Run npm run db:seed first.`);

  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      name,
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
      role: "kitchen_staff",
      kitchenFacilityId: facility.id,
    })
    .returning({ id: schema.users.id });

  console.log(`Created kitchen staff ${email} for ${facility.name} (${user.id}).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
