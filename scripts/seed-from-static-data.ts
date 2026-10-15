import { getDb, getPool } from "../lib/db";
import { seed } from "../lib/db/seed";

async function main() {
  try {
    const counts = await seed(getDb());
    console.log("Seed complete:", counts);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await getPool().end();
  }
}

main();
