-- Explicit human publication intent, separate from editorial sign-off.
CREATE TABLE IF NOT EXISTS editorial_publications (
 article_id UUID NOT NULL, version INTEGER NOT NULL, digest CHAR(64) NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('queued','processing','awaiting-ci','awaiting-deployment','published','blocked','cancelled')),
 requested_by TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), published_at TIMESTAMPTZ,
 receipt JSONB NOT NULL DEFAULT '{}'::jsonb, error TEXT, notified_at TIMESTAMPTZ,
 PRIMARY KEY(article_id,version),
 FOREIGN KEY(article_id,version) REFERENCES editorial_versions(article_id,version)
);
CREATE INDEX IF NOT EXISTS editorial_publications_pending ON editorial_publications(status,requested_at);

ALTER TABLE editorial_checks ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE editorial_publications ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE editorial_versions ADD COLUMN IF NOT EXISTS qa_notified_at TIMESTAMPTZ;
