import { hash } from "@node-rs/argon2";
import { Redis } from "ioredis";
import migrateAndSeed from "../tests/setup/integration-global";
import { applyTestEnv } from "../tests/setup/test-env";
import { CUSTOMER, db, STAFF } from "./support";

/** Fresh test data for the run: migrated and seeded catalog, no orders, one customer, and one Otay staff member. */
export default async function globalSetup() {
  applyTestEnv();
  await migrateAndSeed();

  const pool = db();
  await pool.query(
    `TRUNCATE order_notifications, kitchen_dispatches, openpay_webhook_events, payments, order_status_events,
              order_line_items, orders, cart_line_items, users RESTART IDENTITY CASCADE`,
  );
  const redis = new Redis(process.env.REDIS_URL!);
  await redis.flushdb();
  redis.disconnect();

  // Same Argon2id settings and pepper as lib/auth/password.ts.
  const passwordHash = (password: string) =>
    hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1, secret: Buffer.from(process.env.PASSWORD_PEPPER!) });

  await pool.query(
    `insert into users (email, name, phone, password_hash, email_verified_at, role)
     values ($1, $2, '664 123 4567', $3, now(), 'customer')`,
    [CUSTOMER.email, CUSTOMER.name, await passwordHash(CUSTOMER.password)],
  );
  await pool.query(
    `insert into users (email, name, password_hash, email_verified_at, role, kitchen_facility_id)
     select $1, $2, $3, now(), 'kitchen_staff', id from kitchen_facilities where slug = 'otay'`,
    [STAFF.email, STAFF.name, await passwordHash(STAFF.password)],
  );
  await pool.end();
}
