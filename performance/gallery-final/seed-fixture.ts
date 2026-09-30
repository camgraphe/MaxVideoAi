import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { publicCardToVideo, type PublicExamplesSnapshot } from '../../frontend/server/local-public-examples-data';

const root = resolve(__dirname, '../..');
const fixture = resolve(__dirname, 'fixture');
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8')) as {
  snapshotSha256: string; editorialSqlSha256: string; migration53Sha256: string;
  cards: number; hub: number; feeds: number; capturedAt: string; source: string;
};

function verifiedText(path: string, expected: string): string {
  const data = readFileSync(path);
  const actual = createHash('sha256').update(data).digest('hex');
  if (actual !== expected) throw new Error(`Fixture checksum mismatch: ${path}: ${actual}`);
  return data.toString('utf8');
}

async function main() {
  const snapshot = JSON.parse(verifiedText(resolve(fixture, 'public-examples.json'), manifest.snapshotSha256)) as PublicExamplesSnapshot;
  const editorialSql = verifiedText(resolve(fixture, 'editorial-fixture.sql'), manifest.editorialSqlSha256);
  const migration53 = verifiedText(resolve(root, 'neon/migrations/53_playlist_opening.sql'), manifest.migration53Sha256);
  if (snapshot.version !== 1 || snapshot.source !== manifest.source || snapshot.capturedAt !== manifest.capturedAt ||
      Object.keys(snapshot.cards).length !== manifest.cards || Object.keys(snapshot.feeds).length !== manifest.feeds ||
      snapshot.feeds['']?.playlist.length !== manifest.hub) throw new Error('Frozen public snapshot shape changed');
  for (const feed of Object.values(snapshot.feeds)) {
    for (const id of [...feed.playlist, ...feed['date-desc']]) {
      if (!snapshot.cards[id]) throw new Error(`Feed references absent card ${id}`);
    }
  }
  if (process.argv.includes('--verify-only')) {
    console.log(JSON.stringify({ verified: true, cards: manifest.cards, hub: manifest.hub, feeds: manifest.feeds, sha256: manifest.snapshotSha256 }));
    return;
  }
  const rawUrl = process.env.FIXTURE_DATABASE_URL;
  if (!rawUrl) throw new Error('FIXTURE_DATABASE_URL is required');
  const url = new URL(rawUrl);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname) || url.pathname !== '/postgres' || url.username !== 'postgres') {
    throw new Error('Refusing to seed a database outside the disposable local CI service');
  }
  const pool = new pg.Pool({ connectionString: rawUrl });
  try {
    await pool.query(`
CREATE TABLE playlists(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE,is_public boolean,updated_at timestamptz DEFAULT now());
CREATE TABLE playlist_items(playlist_id uuid,video_id text,order_index int,pinned boolean DEFAULT false,created_at timestamptz DEFAULT now(),PRIMARY KEY(playlist_id,video_id));
CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text DEFAULT 'fixture-owner',engine_id text,engine_label text,prompt text,
thumb_url text,video_url text,preview_video_url text,status text DEFAULT 'completed',surface text DEFAULT 'video',visibility text DEFAULT 'public',indexable boolean DEFAULT true,
created_at timestamptz,updated_at timestamptz DEFAULT now(),duration_sec int,aspect_ratio text,has_audio boolean,can_upscale boolean,
featured boolean,featured_order int,final_price_cents int,currency text,pricing_snapshot jsonb,settings_snapshot jsonb);
CREATE TABLE media_assets(user_id text,url text,status text,deleted_at timestamptz);
CREATE TABLE job_outputs(job_id text,kind text,status text,width int,height int,position int,created_at timestamptz,thumb_url text,url text,storage_url text);
CREATE TABLE app_pricing_rules(id text PRIMARY KEY,engine_id text,mode text,resolution text,
margin_percent numeric DEFAULT 0,margin_flat_cents integer DEFAULT 0,surcharge_audio_percent numeric DEFAULT 0,
surcharge_upscale_percent numeric DEFAULT 0,currency text DEFAULT 'USD',compatibility_profile text,vendor_account_id text,
effective_from timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid);
`);
    for (const migration of ['08_admin_controls.sql', '09_engine_settings.sql', '12_app_settings.sql', '23_video_seo_pages.sql', '24_video_seo_canonical_slug.sql',
      '25_video_seo_visual_context.sql', '40_video_seo_rollout_exclusions.sql', '52_playlist_curations.sql']) {
      await pool.query(readFileSync(resolve(root, 'neon/migrations', migration), 'utf8'));
    }
    await pool.query(migration53);
    for (const card of Object.values(snapshot.cards)) {
      const v = publicCardToVideo(card);
      await pool.query(`INSERT INTO app_jobs(job_id,engine_id,engine_label,prompt,thumb_url,video_url,preview_video_url,created_at,duration_sec,aspect_ratio,has_audio,can_upscale,final_price_cents,currency)
        VALUES($1,$2,$3,$4,$5,$6,$7,'2026-09-27T12:00:00Z',$8,$9,$10,false,$11,$12)`,
      [v.id, v.engineId, v.engineLabel, v.prompt, v.thumbUrl, v.videoUrl, v.previewVideoUrl, v.durationSec, v.aspectRatio, v.hasAudio, v.finalPriceCents, v.currency]);
      if (v.outputWidth && v.outputHeight) {
        await pool.query(`INSERT INTO job_outputs(job_id,kind,status,width,height,position,created_at,url) VALUES($1,'video','completed',$2,$3,0,now(),$4)`,
          [v.id, v.outputWidth, v.outputHeight, v.videoUrl]);
      }
    }
    for (const [family, feed] of Object.entries(snapshot.feeds)) {
      const { rows } = await pool.query(`INSERT INTO playlists(slug,is_public) VALUES($1,true) RETURNING id`, [family ? `family-${family}` : 'examples']);
      for (const [index, id] of feed.playlist.entries()) {
        await pool.query(`INSERT INTO playlist_items(playlist_id,video_id,order_index) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [rows[0].id, id, index]);
      }
      await pool.query(`INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids) VALUES($1,'manual',$2,'{}')`, [rows[0].id, feed.playlist]);
    }
    await pool.query(editorialSql);
    const { rows: [counts] } = await pool.query(`SELECT (SELECT count(*)::int FROM app_jobs) cards, (SELECT count(*)::int FROM playlists) feeds,
      (SELECT count(*)::int FROM playlist_items pi JOIN playlists p ON p.id=pi.playlist_id WHERE p.slug='examples') hub`);
    if (counts.cards !== manifest.cards || counts.feeds !== manifest.feeds || counts.hub !== manifest.hub) {
      throw new Error(`Database count mismatch: ${JSON.stringify(counts)}`);
    }
    console.log(JSON.stringify({ seeded: true, ...counts, sha256: manifest.snapshotSha256 }));
  } finally {
    await pool.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
