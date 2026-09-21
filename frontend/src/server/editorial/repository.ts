import { query, withDbTransaction } from '@/lib/db';
import { digestEditorialDraft, parseEditorialDraft, type EditorialDraft } from '@/lib/editorial/schema';

export type EditorialVersionRef = { articleId: string; version: number; digest: string };
export type EditorialVersion = EditorialVersionRef & {
  draft: EditorialDraft;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
};

type VersionRow = {
  article_id: string;
  version: number;
  digest: string;
  payload: unknown;
  created_at: Date | string;
  approved_at: Date | string | null;
  approved_by: string | null;
};

function toVersion(row: VersionRow): EditorialVersion {
  return {
    articleId: row.article_id,
    version: row.version,
    digest: row.digest.trim(),
    draft: parseEditorialDraft(row.payload),
    createdAt: new Date(row.created_at).toISOString(),
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    approvedBy: row.approved_by,
  };
}

export async function saveEditorialDraft({ draft, actor }: { draft: EditorialDraft; actor: string }): Promise<EditorialVersionRef> {
  const digest = digestEditorialDraft(draft);
  return withDbTransaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [draft.runKey]);
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`editorial-slug:${draft.canonicalSlug}`]);
    const existing = await tx.query<Pick<VersionRow, 'article_id' | 'version' | 'digest'>>(
      'SELECT article_id, version, digest FROM editorial_versions WHERE run_key = $1', [draft.runKey],
    );
    if (existing[0]) {
      if (existing[0].digest.trim() !== digest) throw new Error('Run key already used for different content');
      return { articleId: existing[0].article_id, version: existing[0].version, digest };
    }

    await tx.query(
      `INSERT INTO editorial_topics (topic_key, canonical_slug) VALUES ($1, $2)
       ON CONFLICT (topic_key) DO NOTHING`,
      [draft.topicKey, draft.canonicalSlug],
    );
    const topic = await tx.query<{ canonical_slug: string }>(
      'SELECT canonical_slug FROM editorial_topics WHERE topic_key = $1', [draft.topicKey],
    );
    if (topic[0]?.canonical_slug !== draft.canonicalSlug) throw new Error('Topic key already belongs to another article');

    const articleRows = await tx.query<{ id: string; topic_key: string }>(
      `INSERT INTO editorial_articles (canonical_slug, topic_key) VALUES ($1, $2)
       ON CONFLICT (canonical_slug) DO UPDATE SET canonical_slug = EXCLUDED.canonical_slug
       RETURNING id, topic_key`,
      [draft.canonicalSlug, draft.topicKey],
    );
    const article = articleRows[0];
    if (!article || article.topic_key !== draft.topicKey) throw new Error('Canonical slug already belongs to another topic');
    await tx.query("UPDATE editorial_articles SET status = 'draft' WHERE id = $1", [article.id]);
    const latestRows = await tx.query<{ version: number }>(
      'SELECT COALESCE(MAX(version), 0) AS version FROM editorial_versions WHERE article_id = $1', [article.id],
    );
    const version = Number(latestRows[0]?.version ?? 0) + 1;
    await tx.query(
      `INSERT INTO editorial_versions (article_id, version, run_key, digest, payload, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [article.id, version, draft.runKey, digest, JSON.stringify(draft), actor],
    );
    await tx.query(
      `INSERT INTO editorial_events (article_id, version, kind, actor, detail)
       VALUES ($1, $2, 'draft_created', $3, $4::jsonb)`,
      [article.id, version, actor, JSON.stringify({ digest, runKey: draft.runKey })],
    );
    return { articleId: article.id, version, digest };
  });
}

export async function getEditorialVersion(articleId: string, version: number): Promise<EditorialVersion | null> {
  const rows = await query<VersionRow>(
    `SELECT article_id, version, digest, payload, created_at, approved_at, approved_by
     FROM editorial_versions WHERE article_id = $1 AND version = $2`,
    [articleId, version],
  );
  return rows[0] ? toVersion(rows[0]) : null;
}

export async function getLatestEditorialVersion(articleId: string): Promise<EditorialVersion | null> {
  const rows = await query<VersionRow>(
    `SELECT article_id, version, digest, payload, created_at, approved_at, approved_by
     FROM editorial_versions WHERE article_id = $1 ORDER BY version DESC LIMIT 1`,
    [articleId],
  );
  return rows[0] ? toVersion(rows[0]) : null;
}

export async function approveEditorialVersion(input: { articleId: string; version: number; digest: string; actor: string }): Promise<void> {
  await withDbTransaction(async (tx) => {
    const articleRows = await tx.query<{ status: string }>('SELECT status FROM editorial_articles WHERE id = $1 FOR UPDATE', [input.articleId]);
    if (!articleRows[0]) throw new Error('Editorial article not found');
    const latestRows = await tx.query<VersionRow>(
      `SELECT article_id, version, digest, payload, created_at, approved_at, approved_by
       FROM editorial_versions WHERE article_id = $1 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [input.articleId],
    );
    const latest = latestRows[0];
    if (!latest || latest.version !== input.version || latest.digest.trim() !== input.digest) {
      throw new Error('Approval target is not the latest exact version');
    }
    const corrections = await tx.query("SELECT id FROM editorial_events WHERE article_id=$1 AND version=$2 AND kind='draft_rejected' LIMIT 1", [input.articleId, input.version]);
    if (corrections.length) throw new Error('A correction requires a new editorial version before approval');
    if (latest.approved_at) throw new Error('Editorial version already approved');
    // Editorial sign-off is independent of technical publication readiness.
    await tx.query('UPDATE editorial_versions SET approved_by = $1, approved_at = now() WHERE article_id = $2 AND version = $3', [input.actor, input.articleId, input.version]);
    await tx.query("UPDATE editorial_articles SET status = 'approved' WHERE id = $1", [input.articleId]);
    await tx.query(
      "INSERT INTO editorial_events (article_id, version, kind, actor, detail) VALUES ($1, $2, 'draft_approved', $3, $4::jsonb)",
      [input.articleId, input.version, input.actor, JSON.stringify({ digest: input.digest })],
    );
  });
}

export async function listEditorialDrafts(): Promise<Array<EditorialVersionRef & { title: string; createdAt: string }>> {
  const rows = await query<VersionRow>(
    `SELECT DISTINCT ON (article_id) article_id, version, digest, payload, created_at, approved_at, approved_by
     FROM editorial_versions ORDER BY article_id, version DESC`,
  );
  return rows.map((row) => ({
    articleId: row.article_id,
    version: row.version,
    digest: row.digest.trim(),
    title: parseEditorialDraft(row.payload).locales.en.title,
    createdAt: new Date(row.created_at).toISOString(),
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
