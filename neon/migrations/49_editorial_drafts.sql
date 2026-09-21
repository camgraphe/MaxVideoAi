-- Draft-only editorial records. Public blog readers do not query these tables.
CREATE TABLE IF NOT EXISTS editorial_topics (
  topic_key TEXT PRIMARY KEY,
  canonical_slug TEXT NOT NULL UNIQUE,
  intent TEXT,
  duplicate_of TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editorial_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_slug TEXT NOT NULL UNIQUE,
  topic_key TEXT NOT NULL REFERENCES editorial_topics(topic_key),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editorial_versions (
  article_id UUID NOT NULL REFERENCES editorial_articles(id),
  version INTEGER NOT NULL CHECK (version > 0),
  run_key TEXT NOT NULL UNIQUE,
  digest CHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  PRIMARY KEY (article_id, version),
  CHECK ((approved_by IS NULL) = (approved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS editorial_versions_article_latest_idx ON editorial_versions(article_id, version DESC);

CREATE TABLE IF NOT EXISTS editorial_events (
  id BIGSERIAL PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES editorial_articles(id),
  version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('draft_created','draft_approved','draft_rejected','draft_error')),
  actor TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (article_id, version) REFERENCES editorial_versions(article_id, version)
);
