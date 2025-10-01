ALTER TABLE "organizations" ADD COLUMN "auto_top_up_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "auto_top_up_threshold" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "auto_top_up_package_id" text DEFAULT 'starter';