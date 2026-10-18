CREATE TABLE "order_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_notifications_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "order_notifications_channel" CHECK ("order_notifications"."channel" IN ('email', 'whatsapp')),
	CONSTRAINT "order_notifications_status" CHECK ("order_notifications"."status" IN ('pending', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_notifications_pending_idx" ON "order_notifications" USING btree ("created_at") WHERE "order_notifications"."status" = 'pending';