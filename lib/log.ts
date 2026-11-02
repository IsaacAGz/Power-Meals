type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

// Matched against field names, at any depth. Secrets are dropped; contact details are masked so a line can
// still be matched to a customer by someone who already has the order open.
const SECRET_KEY = /pass(word)?|token|secret|authorization|cookie|pepper/i;
const PHONE_KEY = /phone|telefono|whatsapp_?to|recipient/i;
const EMAIL_KEY = /e-?mail|correo/i;
const ADDRESS_KEY = /address|direccion|street|calle/i;

const MAX_DEPTH = 5;

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > 4 ? `***${digits.slice(-4)}` : "***";
}

function maskEmail(value: string): string {
  const at = value.lastIndexOf("@");
  return at > 0 ? `${value[0]}***${value.slice(at)}` : "***";
}

function redactValue(key: string, value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") {
    if (PHONE_KEY.test(key)) return maskPhone(value);
    if (EMAIL_KEY.test(key)) return maskEmail(value);
    if (ADDRESS_KEY.test(key)) return "[redacted]";
    return value;
  }
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item, depth + 1));
  if (ADDRESS_KEY.test(key)) return "[redacted]";
  return redactFields(value as Fields, depth + 1);
}

export function redactFields(fields: Fields, depth = 0): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) out[key] = redactValue(key, value, depth);
  return out;
}

/** One JSON line per event, read by journald and shipped to CloudWatch Logs. */
export function formatLine(level: Level, event: string, fields: Fields = {}): string {
  return JSON.stringify({ ts: new Date().toISOString(), level, event, ...redactFields(fields) });
}

function write(level: Level, event: string, fields?: Fields) {
  const line = formatLine(level, event, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};

/** For catch blocks: the message without the stack, which journald would split across lines. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
