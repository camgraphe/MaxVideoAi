CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS legal_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  url text NOT NULL,
  reason text NOT NULL,
  details text NOT NULL,
  attachment_filename text,
  attachment_base64 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE legal_reports
  ADD CONSTRAINT legal_reports_attachment_size CHECK (
    attachment_base64 IS NULL OR char_length(attachment_base64) <= 3500000
  );

CREATE INDEX IF NOT EXISTS legal_reports_created_at_idx ON legal_reports (created_at DESC);
