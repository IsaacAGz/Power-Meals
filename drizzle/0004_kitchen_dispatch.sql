CREATE TABLE "kitchen_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kitchen_facility_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sqs_message_id" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kitchen_dispatches_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "kitchen_dispatches_status" CHECK ("kitchen_dispatches"."status" IN ('pending', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "kitchen_dispatches" ADD CONSTRAINT "kitchen_dispatches_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_dispatches" ADD CONSTRAINT "kitchen_dispatches_kitchen_facility_id_kitchen_facilities_id_fk" FOREIGN KEY ("kitchen_facility_id") REFERENCES "public"."kitchen_facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kitchen_dispatches_pending_idx" ON "kitchen_dispatches" USING btree ("created_at") WHERE "kitchen_dispatches"."status" = 'pending';