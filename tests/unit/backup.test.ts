import { EventEmitter } from "node:events";
import { PassThrough, type Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeChild = EventEmitter & { stdout: PassThrough; stderr: PassThrough };

const spawned = vi.hoisted(() => ({ calls: [] as { args: string[]; env: NodeJS.ProcessEnv }[], child: undefined as unknown }));
const uploads = vi.hoisted(() => ({ params: [] as Record<string, unknown>[], received: [] as Buffer[], completed: 0 }));

vi.mock("node:child_process", () => ({
  spawn: vi.fn((_command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
    spawned.calls.push({ args, env: options.env });
    return spawned.child;
  }),
}));
vi.mock("@aws-sdk/client-s3", () => ({ S3Client: vi.fn() }));
// Reads the body to the end like S3 would; completes only if the stream ends cleanly.
vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: vi.fn(function (this: unknown, { params }: { params: Record<string, unknown> & { Body: Readable } }) {
    uploads.params.push(params);
    return {
      done: async () => {
        for await (const chunk of params.Body) uploads.received.push(chunk as Buffer);
        uploads.completed += 1;
        return { Key: params.Key };
      },
    };
  }),
}));

const { backupDatabase, backupKey, pgDumpConnection } = await import("@/lib/ops/backup");

function fakeChild(): FakeChild {
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
  spawned.child = child;
  return child;
}

/** Writes stdout/stderr, ends both, then emits close the way a real child process does. */
async function finish(child: FakeChild, { stdout = "", stderr = "", code = 0 }) {
  if (stdout) child.stdout.write(stdout);
  if (stderr) child.stderr.write(stderr);
  child.stdout.end();
  child.stderr.end();
  await new Promise((resolve) => setImmediate(resolve));
  child.emit("close", code, null);
}

const NOW = new Date("2026-11-02T10:30:05.123Z");

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://powermeals:s3cr%40t@127.0.0.1:5432/powermeals");
  vi.stubEnv("BACKUP_S3_BUCKET", "power-meals-backups");
  vi.stubEnv("BACKUP_S3_PREFIX", "postgres/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  spawned.calls = [];
  uploads.params = [];
  uploads.received = [];
  uploads.completed = 0;
});

describe("backupKey", () => {
  it("dates the key by day under the prefix, without colons or milliseconds", () => {
    expect(backupKey("powermeals", NOW)).toBe("postgres/2026/11/02/powermeals-2026-11-02T10-30-05Z.dump");
  });

  it("adds the trailing slash to a prefix that lacks it", () => {
    expect(backupKey("powermeals", NOW, "db")).toBe("db/2026/11/02/powermeals-2026-11-02T10-30-05Z.dump");
  });
});

describe("pgDumpConnection", () => {
  it("takes the password out of the URL and decodes it", () => {
    expect(pgDumpConnection("postgres://powermeals:s3cr%40t@127.0.0.1:5432/powermeals")).toEqual({
      dbname: "postgres://powermeals@127.0.0.1:5432/powermeals",
      database: "powermeals",
      password: "s3cr@t",
    });
  });

  it("rejects a URL without a database name", () => {
    expect(() => pgDumpConnection("postgres://powermeals@127.0.0.1:5432")).toThrow(/no database name/);
  });
});

describe("backupDatabase", () => {
  it("streams the dump to S3 and keeps the password out of argv", async () => {
    const child = fakeChild();
    const result = backupDatabase(NOW);
    await finish(child, { stdout: "PGDMP-data" });

    await expect(result).resolves.toMatchObject({
      bucket: "power-meals-backups",
      key: "postgres/2026/11/02/powermeals-2026-11-02T10-30-05Z.dump",
      bytes: 10,
    });
    expect(Buffer.concat(uploads.received).toString()).toBe("PGDMP-data");
    expect(uploads.completed).toBe(1);
    expect(uploads.params[0]).toMatchObject({ Bucket: "power-meals-backups", ServerSideEncryption: "AES256" });

    const { args, env } = spawned.calls[0];
    expect(args).toContain("--format=custom");
    expect(args.join(" ")).not.toContain("s3cr");
    expect(env.PGPASSWORD).toBe("s3cr@t");
  });

  it("fails with pg_dump's error and never completes the upload when pg_dump exits non-zero", async () => {
    const child = fakeChild();
    const result = backupDatabase(NOW);
    await finish(child, { stdout: "PGDMP-partial", stderr: "pg_dump: error: connection refused\n", code: 1 });

    await expect(result).rejects.toThrow("pg_dump exited with code 1: pg_dump: error: connection refused");
    expect(uploads.completed).toBe(0);
  });

  it("fails when pg_dump cannot be started", async () => {
    const child = fakeChild();
    const result = backupDatabase(NOW);
    child.emit("error", new Error("spawn pg_dump ENOENT"));

    await expect(result).rejects.toThrow("spawn pg_dump ENOENT");
    expect(uploads.completed).toBe(0);
  });

  it("requires the bucket before starting pg_dump", async () => {
    vi.stubEnv("BACKUP_S3_BUCKET", "");

    await expect(backupDatabase(NOW)).rejects.toThrow("BACKUP_S3_BUCKET");
    expect(spawned.calls).toHaveLength(0);
  });
});
