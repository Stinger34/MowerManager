CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mower_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"title" text,
	"file_type" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"description" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
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
	"notes" text
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
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_mower_id_mowers_id_fk" FOREIGN KEY ("mower_id") REFERENCES "public"."mowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_mower_id_mowers_id_fk" FOREIGN KEY ("mower_id") REFERENCES "public"."mowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mower_id_mowers_id_fk" FOREIGN KEY ("mower_id") REFERENCES "public"."mowers"("id") ON DELETE cascade ON UPDATE no action;