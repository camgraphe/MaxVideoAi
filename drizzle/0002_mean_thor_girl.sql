ALTER TABLE "organizations" ADD COLUMN "plan" text;
ALTER TABLE "organizations" ADD COLUMN "subscription_status" text;
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" text;
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_id" text;
ALTER TABLE "organizations" ADD COLUMN "billing_email" text;
ALTER TABLE "organizations" ADD COLUMN "seats_limit" integer DEFAULT 1 NOT NULL;
