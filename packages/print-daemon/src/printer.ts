import { writeFile } from "node:fs/promises";
import { connect, type Socket } from "node:net";
import type { Receipt } from "./receipt.ts";

export type PrinterOptions = { target: string; timeoutMs: number; checkPaperStatus: boolean };

// DLE EOT 4: roll paper sensor status. Bits 5 and 6 set mean the paper has run out.
const PAPER_STATUS = Buffer.from([0x10, 0x04, 0x04]);
const PAPER_OUT_BITS = 0x60;

/**
 * Targets: `tcp://host:9100` (network printer, raw port), `file:/dev/usb/lp0` (USB on Linux, or any file to
 * capture the bytes), `stdout` (text preview for setup). Throws on any failure so the message is retried.
 */
export async function print(receipt: Receipt, options: PrinterOptions): Promise<void> {
  if (options.target === "stdout") {
    process.stdout.write(`${receipt.text}${"=".repeat(20)}\n`);
    return;
  }
  if (options.target.startsWith("file:")) {
    await writeFile(options.target.slice("file:".length), receipt.escpos, {
      flag: "a",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    return;
  }
  if (options.target.startsWith("tcp://")) {
    const url = new URL(options.target);
    await printTcp(url.hostname, Number(url.port || 9100), receipt.escpos, options);
    return;
  }
  throw new Error(`Unsupported PRINTER_TARGET "${options.target}"`);
}

function printTcp(host: string, port: number, data: Buffer, options: PrinterOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(options.timeoutMs, () => fail(new Error(`Printer ${host}:${port} timed out`)));
    socket.once("error", fail);
    socket.once("connect", async () => {
      try {
        if (options.checkPaperStatus) await assertPaper(socket);
        socket.end(data, () => {
          settled = true;
          resolve();
        });
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

function assertPaper(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("data", (chunk: Buffer) => {
      if ((chunk[0] & PAPER_OUT_BITS) === PAPER_OUT_BITS) reject(new Error("Printer is out of paper"));
      else resolve();
    });
    socket.write(PAPER_STATUS);
  });
}
