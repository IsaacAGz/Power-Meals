import "server-only";
import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { requireEnv } from "@/lib/env";

const DEFAULT_PREFIX = "postgres/";
const STDERR_LIMIT = 2_000;

export type BackupResult = { bucket: string; key: string; bytes: number; seconds: number };

/** `postgres/2026/11/02/powermeals-2026-11-02T10-30-00Z.dump`: sorts by time, and the lifecycle rule matches the prefix. */
export function backupKey(database: string, now: Date, prefix = DEFAULT_PREFIX): string {
  const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
  const [year, month, day] = iso.slice(0, 10).split("-");
  const base = prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix;
  return `${base}${year}/${month}/${day}/${database}-${iso}.dump`;
}

/**
 * Splits DATABASE_URL so the password reaches pg_dump through PGPASSWORD instead of argv, where any user on the
 * host could read it from the process list.
 */
export function pgDumpConnection(databaseUrl: string): { dbname: string; database: string; password?: string } {
  const url = new URL(databaseUrl);
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  url.password = "";
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL has no database name");
  return { dbname: url.toString(), database, password };
}

/**
 * Streams `pg_dump --format=custom` straight into S3 (multipart, nothing written to disk). The upload only
 * completes after pg_dump exits 0; a failed dump destroys the stream, so the upload is aborted instead of
 * leaving a truncated object that looks like a good backup.
 */
export async function backupDatabase(now = new Date()): Promise<BackupResult> {
  const bucket = requireEnv("BACKUP_S3_BUCKET");
  const { dbname, database, password } = pgDumpConnection(requireEnv("DATABASE_URL"));
  const key = backupKey(database, now, process.env.BACKUP_S3_PREFIX ?? DEFAULT_PREFIX);
  const started = Date.now();

  const child = spawn("pg_dump", ["--format=custom", "--compress=6", `--dbname=${dbname}`], {
    env: { ...process.env, ...(password ? { PGPASSWORD: password } : {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const body = new PassThrough();
  let bytes = 0;
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
  });
  child.stdout.pipe(body, { end: false });
  child.stderr.on("data", (chunk: Buffer) => {
    if (stderr.length < STDERR_LIMIT) stderr = (stderr + chunk.toString()).slice(0, STDERR_LIMIT);
  });

  const dumped = new Promise<void>((resolve, reject) => {
    child.on("error", (error) => {
      body.destroy(error);
      reject(error);
    });
    // "close" fires after stdout has ended, so every chunk is already in `body`.
    child.on("close", (code, signal) => {
      if (code === 0) {
        body.end();
        resolve();
        return;
      }
      const error = new Error(`pg_dump exited with ${signal ?? `code ${code}`}: ${stderr.trim() || "no output"}`);
      body.destroy(error);
      reject(error);
    });
  });

  const upload = new Upload({
    client: new S3Client({ region: process.env.AWS_REGION, maxAttempts: 3 }),
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
      ServerSideEncryption: "AES256",
    },
    leavePartsOnError: false,
  });

  // pg_dump's own error is the useful one; the upload's rejection is only the destroyed stream.
  const [dumpResult, uploadResult] = await Promise.allSettled([dumped, upload.done()]);
  if (dumpResult.status === "rejected") throw dumpResult.reason;
  if (uploadResult.status === "rejected") throw uploadResult.reason;

  return { bucket, key, bytes, seconds: Math.round((Date.now() - started) / 1000) };
}
