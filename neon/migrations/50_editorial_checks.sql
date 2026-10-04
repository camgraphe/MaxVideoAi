-- Existing application database only. Applied explicitly; never from read routes.
CREATE TABLE IF NOT EXISTS editorial_checks (
 article_id UUID NOT NULL, version INTEGER NOT NULL, digest CHAR(64) NOT NULL,
 renderer_version TEXT NOT NULL, report JSONB NOT NULL, actor TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(article_id,version),
 FOREIGN KEY(article_id,version) REFERENCES editorial_versions(article_id,version)
);
