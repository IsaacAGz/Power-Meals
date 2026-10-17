export type Config = {
  queueUrl: string;
  region: string | undefined;
  endpoint: string | undefined;
  facilityId: string;
  printerTarget: string;
  printerColumns: number;
  printerTimeoutMs: number;
  checkPaperStatus: boolean;
  retryVisibilitySeconds: number;
  otherFacilityVisibilitySeconds: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return Math.min(max, Math.max(min, value));
}

/** The printer target alone is enough for `test-print`; the daemon also needs the queue and facility. */
export function loadPrinterConfig() {
  return {
    printerTarget: process.env.PRINTER_TARGET || "stdout",
    printerColumns: integer("PRINTER_COLUMNS", 48, 32, 64),
    printerTimeoutMs: integer("PRINTER_TIMEOUT_MS", 10_000, 1_000, 60_000),
    checkPaperStatus: process.env.PRINTER_CHECK_STATUS === "true",
  };
}

export function loadConfig(): Config {
  const facilityId = required("KITCHEN_FACILITY_ID");
  if (!UUID_PATTERN.test(facilityId)) throw new Error("KITCHEN_FACILITY_ID must be the facility UUID from kitchen_facilities.id");
  return {
    queueUrl: required("QUEUE_URL"),
    region: process.env.AWS_REGION,
    endpoint: process.env.SQS_ENDPOINT || undefined,
    facilityId,
    ...loadPrinterConfig(),
    retryVisibilitySeconds: integer("PRINT_RETRY_VISIBILITY_SECONDS", 120, 60, 300),
    otherFacilityVisibilitySeconds: integer("OTHER_FACILITY_VISIBILITY_SECONDS", 5, 0, 300),
  };
}
