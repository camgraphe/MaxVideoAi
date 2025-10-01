CREATE TABLE "organization_credit_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"performed_by" uuid,
	"job_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_credit_ledger" ADD CONSTRAINT "organization_credit_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_credit_ledger" ADD CONSTRAINT "organization_credit_ledger_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_credit_ledger" ADD CONSTRAINT "organization_credit_ledger_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_credit_ledger_org_created_idx" ON "organization_credit_ledger" USING btree ("organization_id","created_at");