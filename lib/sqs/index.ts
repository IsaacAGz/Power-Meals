import "server-only";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { FACILITY_ATTRIBUTE, ORDER_ATTRIBUTE, type KitchenTicket } from "@/packages/print-daemon/src/contract";

const SEND_TIMEOUT_MS = 10_000;

let client: SQSClient | undefined;

export function isKitchenQueueConfigured(): boolean {
  return Boolean(process.env.SQS_QUEUE_URL);
}

/** Credentials come from the default AWS chain (the EC2 instance role in production). */
function getClient(): SQSClient {
  client ??= new SQSClient({
    region: process.env.AWS_REGION,
    endpoint: process.env.SQS_ENDPOINT || undefined,
    maxAttempts: 3,
  });
  return client;
}

export async function publishKitchenTicket(ticket: KitchenTicket): Promise<string> {
  const output = await getClient().send(
    new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(ticket),
      MessageAttributes: {
        [FACILITY_ATTRIBUTE]: { DataType: "String", StringValue: ticket.kitchenFacilityId },
        [ORDER_ATTRIBUTE]: { DataType: "String", StringValue: ticket.orderId },
      },
    }),
    { abortSignal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
  );
  return output.MessageId ?? "";
}
