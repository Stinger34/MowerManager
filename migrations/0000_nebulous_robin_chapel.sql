CREATE TABLE "asset_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_id" integer NOT NULL,
	"mower_id" integer,
	"engine_id" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"install_date" date,
	"service_record_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mower_id" integer,
	"engine_id" integer,
	"part_id" integer,
	"file_name" text NOT NULL,
	"title" text,
	"file_type" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"page_count" integer,
	"description" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engines" (
	"id" serial PRIMARY KEY NOT NULL,
	"mower_id" integer,
	"name" text NOT NULL,
	"description" text,
	"part_number" text,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"install_date" date,
	"condition" text DEFAULT 'good' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"cost" numeric(10, 2),
	"thumbnail_attachment_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mowers" (
	"id" serial PRIMARY KEY NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer,
	"serialnumber" text,
	"purchasedate" date,
	"purchaseprice" numeric(10, 2),
	"location" text,
	"condition" text DEFAULT 'good' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_service_date" date,
	"next_service_date" date,
	"thumbnail_attachment_id" varchar,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"entity_name" text,
	"detail_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"part_number" text NOT NULL,
	"manufacturer" text,
	"category" text NOT NULL,
	"unit_cost" numeric(10, 2),
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"min_stock_level" integer DEFAULT 0,
	"thumbnail_attachment_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mower_id" integer NOT NULL,
	"service_date" timestamp NOT NULL,
	"service_type" text NOT NULL,
	"description" text NOT NULL,
	"cost" numeric(10, 2),
	"performed_by" text,
	"next_service_due" timestamp,
	"mileage" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mower_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp,
	"estimated_cost" numeric(10, 2),
	"part_number" text,
	"category" text DEFAULT 'maintenance' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "asset_parts" ADD CONSTRAINT "asset_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_parts" ADD CONSTRAINT "asset_parts_mower_id_mowers_id_fk" FOREIGN KEY ("mower_id") REFERENCES "public"."mowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_parts" ADD CONSTRAINT "asset_parts_engine_id_engines_id_fk" FOREIGN KEY ("engine_id") REFERENCES "public"."engines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_parts" ADD CONSTRAINT "asset_parts_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_mower_id_mowers_id_fk" FOREIGN KEY ("mower_id") REFERENCES "public"."mowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_engine_id_engines_id_fk" FOREIGN KEY ("engine_id") REFERENCES "public"."engines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engines" ADD CONSTRAINT "engines_mower_id_mowers_id_fk" FOREIGN KEY ("mower_id") REFERENCES "public"."mowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_mower_id_mowers_id_fk" FOREIGN KEY ("mower_id") REFERENCES "public"."mowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mower_id_mowers_id_fk" FOREIGN KEY ("mower_id") REFERENCES "public"."mowers"("id") ON DELETE cascade ON UPDATE no action;