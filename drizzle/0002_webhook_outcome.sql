DROP INDEX "openpay_webhook_events_processed_once_idx";--> statement-breakpoint
ALTER TABLE "openpay_webhook_events" ADD COLUMN "outcome" text;--> statement-breakpoint
CREATE UNIQUE INDEX "openpay_webhook_events_applied_once_idx" ON "openpay_webhook_events" USING btree ("openpay_transaction_id","event_type") WHERE "openpay_webhook_events"."outcome" IN ('paid', 'failed');