import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../../lib/db/schema";
import { seed } from "../../lib/db/seed";
import { applyTestEnv } from "./test-env";

/** Once per run: migrate the test database and load the catalog, kitchens, and pickup points. */
export default async function setup() {
  applyTestEnv();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("select 1");
  } catch (error) {
    await pool.end();
    const name = new URL(process.env.DATABASE_URL!).pathname.slice(1);
    throw new Error(
      `Cannot reach the test database "${name}". Create it once with: sudo -u postgres createdb -O powermeals ${name}`,
      { cause: error },
    );
  }
  try {
    const db = drizzle({ client: pool, schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    await seed(db);
  } finally {
    await pool.end();
  }
}
