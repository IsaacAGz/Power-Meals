import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";
import { loadConfig } from "./config.ts";
import { FACILITY_ATTRIBUTE, ORDER_ATTRIBUTE } from "./contract.ts";
import { print } from "./printer.ts";
import { parseTicket, renderReceipt } from "./receipt.ts";

const config = loadConfig();
const sqs = new SQSClient({ region: config.region, endpoint: config.endpoint });
const printerOptions = {
  target: config.printerTarget,
  timeoutMs: config.printerTimeoutMs,
  checkPaperStatus: config.checkPaperStatus,
};

const MAX_BACKOFF_SECONDS = 300;
const RECEIVE_ERROR_PAUSE_MS = 5_000;
const MEMORY_LIMIT = 1_000;

// SQS can deliver a message twice; remembering recent order ids keeps that from printing two tickets.
const printedOrders = new Map<string, true>();
// Print failures per message id, for the visibility backoff.
const failures = new Map<string, number>();

let stopping = false;
const shutdown = new AbortController();

function log(fields: Record<string, unknown>) {
  console.info(JSON.stringify({ time: new Date().toISOString(), facility: config.facilityId, ...fields }));
}

function remember<T>(map: Map<string, T>, key: string, value: T) {
  map.delete(key);
  map.set(key, value);
  if (map.size > MEMORY_LIMIT) map.delete(map.keys().next().value as string);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function setVisibility(message: Message, seconds: number) {
  await sqs.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: config.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
      VisibilityTimeout: seconds,
    }),
  );
}

async function remove(message: Message) {
  await sqs.send(new DeleteMessageCommand({ QueueUrl: config.queueUrl, ReceiptHandle: message.ReceiptHandle }));
}

/** Never throws: one bad message or printer error must not stop the poll loop. */
async function handle(message: Message) {
  const messageId = message.MessageId ?? "";
  const orderId = message.MessageAttributes?.[ORDER_ATTRIBUTE]?.StringValue;
  const facility = message.MessageAttributes?.[FACILITY_ATTRIBUTE]?.StringValue;

  if (facility !== config.facilityId) {
    // Another kitchen's ticket: hand it back after a short delay so that kitchen's daemon can take it.
    await setVisibility(message, config.otherFacilityVisibilitySeconds).catch((error) =>
      log({ event: "release_failed", orderId, error: errorMessage(error) }),
    );
    return;
  }

  try {
    const ticket = parseTicket(message.Body);
    if (ticket.kitchenFacilityId !== config.facilityId) throw new Error("Ticket body is for another facility");
    if (printedOrders.has(ticket.orderId)) {
      log({ event: "duplicate", orderId: ticket.orderId, orderNumber: ticket.orderNumber });
    } else {
      await print(renderReceipt(ticket, config.printerColumns), printerOptions);
      remember(printedOrders, ticket.orderId, true);
      log({ event: "printed", orderId: ticket.orderId, orderNumber: ticket.orderNumber });
    }
    failures.delete(messageId);
  } catch (error) {
    const attempt = (failures.get(messageId) ?? 0) + 1;
    remember(failures, messageId, attempt);
    const backoff = Math.min(MAX_BACKOFF_SECONDS, config.retryVisibilitySeconds * 2 ** (attempt - 1));
    log({ event: "print_failed", orderId, attempt, retryInSeconds: backoff, error: errorMessage(error) });
    await setVisibility(message, backoff).catch((visibilityError) =>
      log({ event: "backoff_failed", orderId, error: errorMessage(visibilityError) }),
    );
    return;
  }

  // If the delete fails the message comes back, and the printed-order memory skips the reprint.
  await remove(message).catch((error) => log({ event: "delete_failed", orderId, error: errorMessage(error) }));
}

async function pause(ms: number) {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    shutdown.signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function run() {
  log({ event: "started", queue: config.queueUrl, printer: config.printerTarget });
  while (!stopping) {
    let messages: Message[];
    try {
      const output = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: config.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          MessageAttributeNames: [FACILITY_ATTRIBUTE, ORDER_ATTRIBUTE],
        }),
        { abortSignal: shutdown.signal },
      );
      messages = output.Messages ?? [];
    } catch (error) {
      if (stopping) break;
      log({ event: "receive_failed", error: errorMessage(error) });
      await pause(RECEIVE_ERROR_PAUSE_MS);
      continue;
    }
    for (const message of messages) await handle(message);
  }
  log({ event: "stopped" });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopping = true;
    shutdown.abort();
  });
}

await run();
