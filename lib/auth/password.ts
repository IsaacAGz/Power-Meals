import { hash, verify } from "@node-rs/argon2";
import { requireEnv } from "@/lib/env";

// Argon2id (library default) at the OWASP minimum: 19 MiB, 2 passes, 1 lane. The salt is generated per hash
// and stored in the PHC string; the pepper is Argon2's secret input and lives only in the environment.
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

function pepper(): Buffer {
  const value = requireEnv("PASSWORD_PEPPER");
  if (value.length < 32) throw new Error("PASSWORD_PEPPER must be at least 32 characters");
  return Buffer.from(value, "utf8");
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, { ...ARGON2_OPTIONS, secret: pepper() });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, { secret: pepper() });
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Burns the same time as a real check so a missing account isn't distinguishable by response time. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("power-meals-timing-equalizer");
  await verifyPassword(await dummyHash, password);
  return false;
}
