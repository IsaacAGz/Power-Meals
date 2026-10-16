CREATE TYPE "public"."cart_line_source" AS ENUM('builder', 'template', 'reorder', 'package');--> statement-breakpoint
CREATE TYPE "public"."order_line_kind" AS ENUM('meal', 'package', 'package_slot');--> statement-breakpoint
CREATE TYPE "public"."plate_style" AS ENUM('balanced', 'double_carb');--> statement-breakpoint
CREATE TYPE "public"."portion_size" AS ENUM('regular', 'plus');--> statement-breakpoint
CREATE TYPE "public"."protein_tier" AS ENUM('base', 'premium');--> statement-breakpoint
CREATE TABLE "carb_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"has_carb_portion" boolean DEFAULT true NOT NULL,
	"includes_veggies" boolean DEFAULT true NOT NULL,
	"allows_double_carb" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carb_bases_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cart_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"line_key" text NOT NULL,
	"source" "cart_line_source" NOT NULL,
	"item" jsonb NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_line_items_quantity_range" CHECK ("cart_line_items"."quantity" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE TABLE "catalog_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_filters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "meal_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"product_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"meal_count" integer NOT NULL,
	"size" "portion_size" NOT NULL,
	"price_cents" integer NOT NULL,
	"rules" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_packages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "meal_packages_price_positive" CHECK ("meal_packages"."price_cents" > 0),
	CONSTRAINT "meal_packages_meal_count_range" CHECK ("meal_packages"."meal_count" BETWEEN 1 AND 30)
);
--> statement-breakpoint
CREATE TABLE "meal_template_filters" (
	"template_id" uuid NOT NULL,
	"filter_id" uuid NOT NULL,
	CONSTRAINT "meal_template_filters_template_id_filter_id_pk" PRIMARY KEY("template_id","filter_id")
);
--> statement-breakpoint
CREATE TABLE "meal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"protein_id" uuid NOT NULL,
	"carb_base_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"sku_regular" text,
	"sku_plus" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "order_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"parent_line_id" uuid,
	"kind" "order_line_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"quantity" integer NOT NULL,
	"display_name" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"protein_id" uuid,
	"carb_base_id" uuid,
	"portion_size" "portion_size",
	"plate_style" "plate_style",
	"protein_grams" integer,
	"carb_grams" integer,
	"veg_grams" integer,
	"salsa_note" text,
	"template_id" uuid,
	"package_id" uuid,
	"item" jsonb,
	CONSTRAINT "order_line_items_quantity_range" CHECK ("order_line_items"."quantity" BETWEEN 1 AND 20),
	CONSTRAINT "order_line_items_price_non_negative" CHECK ("order_line_items"."unit_price_cents" >= 0 AND "order_line_items"."line_total_cents" >= 0),
	CONSTRAINT "order_line_items_slot_has_parent" CHECK (("order_line_items"."kind" = 'package_slot') = ("order_line_items"."parent_line_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "portion_sizes" (
	"size" "portion_size" PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"base_price_cents" integer NOT NULL,
	"protein_grams" integer NOT NULL,
	"carb_grams" integer NOT NULL,
	"veg_grams" integer NOT NULL,
	"double_carb_grams" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portion_sizes_price_positive" CHECK ("portion_sizes"."base_price_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "proteins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tier" "protein_tier" NOT NULL,
	"regular_upgrade_cents" integer DEFAULT 0 NOT NULL,
	"plus_upgrade_cents" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proteins_slug_unique" UNIQUE("slug"),
	CONSTRAINT "proteins_upgrade_non_negative" CHECK ("proteins"."regular_upgrade_cents" >= 0 AND "proteins"."plus_upgrade_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cart_lines" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dishes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "cart_lines" CASCADE;--> statement-breakpoint
DROP TABLE "categories" CASCADE;--> statement-breakpoint
DROP TABLE "dishes" CASCADE;--> statement-breakpoint
DROP TABLE "order_items" CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "public_order_ref" text;--> statement-breakpoint
UPDATE "orders" SET "public_order_ref" = rtrim(translate(encode(decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '+/', '-_'), '=') WHERE "public_order_ref" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "public_order_ref" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_line_items" ADD CONSTRAINT "cart_line_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_template_filters" ADD CONSTRAINT "meal_template_filters_template_id_meal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."meal_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_template_filters" ADD CONSTRAINT "meal_template_filters_filter_id_catalog_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."catalog_filters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_protein_id_proteins_id_fk" FOREIGN KEY ("protein_id") REFERENCES "public"."proteins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_carb_base_id_carb_bases_id_fk" FOREIGN KEY ("carb_base_id") REFERENCES "public"."carb_bases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_parent_line_id_order_line_items_id_fk" FOREIGN KEY ("parent_line_id") REFERENCES "public"."order_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_protein_id_proteins_id_fk" FOREIGN KEY ("protein_id") REFERENCES "public"."proteins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_carb_base_id_carb_bases_id_fk" FOREIGN KEY ("carb_base_id") REFERENCES "public"."carb_bases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_template_id_meal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."meal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_package_id_meal_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."meal_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_line_items_user_line_idx" ON "cart_line_items" USING btree ("user_id","line_key");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_packages_variant_idx" ON "meal_packages" USING btree ("product_slug","meal_count","size");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_templates_composition_idx" ON "meal_templates" USING btree ("protein_id","carb_base_id");--> statement-breakpoint
CREATE INDEX "order_line_items_order_idx" ON "order_line_items" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_public_order_ref_unique" UNIQUE("public_order_ref");