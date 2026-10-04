import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseEditorialDraft } from '../../frontend/lib/editorial/schema';
import { saveEditorialDraft } from '../../frontend/src/server/editorial/repository';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname)) {
    throw new Error('The local import command accepts only a loopback PostgreSQL database');
  }
  const file = path.resolve(process.argv[2] || 'content/editorial-drafts/2026-09-18-ai-video-workflow.json');
  const draft = parseEditorialDraft(JSON.parse(await readFile(file, 'utf8')));
  for (const asset of draft.assets) {
    const local = path.join(path.dirname(file), 'media', path.basename(asset.storageKey));
    if (asset.sha256 && createHash('sha256').update(await readFile(local)).digest('hex') !== asset.sha256) throw new Error(`Local media digest differs: ${asset.id}`);
    if ((await stat(local)).size !== asset.bytes) throw new Error(`Local media size differs from manifest: ${asset.id}`);
  }
  const result = await saveEditorialDraft({ draft, actor: 'local-manual-import' });
  process.stdout.write(JSON.stringify({ ...result, previewPath: `/admin/editorial/${result.articleId}?version=${result.version}` }) + '\n');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
