CREATE TABLE IF NOT EXISTS "organization_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" "org_role" NOT NULL DEFAULT 'member',
  "token" text NOT NULL,
  "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invites_org_email_idx
  ON "organization_invites" ("organization_id", "email");
