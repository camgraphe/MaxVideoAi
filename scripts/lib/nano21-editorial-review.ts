import { z } from 'zod';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import { nano21EditorialRecipeFields } from '../../frontend/lib/nano21-editorial-recipes';

const file = z.string().refine(isAbsolute, 'Use an absolute private file path');
const draftSchema = nano21EditorialRecipeFields.omit({ status: true, media: true, provenance: true }).extend({
  status: z.literal('draft'),
  media: z.object({ originalFile: file, displayFile: file }).strict(),
  provenance: z.object({ kind: z.literal('external_vertex'), location: z.literal('global'),
    generatedAt: z.string().datetime(), responseFile: file }).strict(),
}).strict();

export async function assertPrivateReviewPath(path: string): Promise<void> {
  if (!isAbsolute(path)) throw new Error('Use an absolute private review path.');
  // Resolve symlinks in the parent as well as refusing obvious public destinations.
  const canonical = await realpath(path).catch(async () => {
    const { dirname, basename } = await import('node:path');
    return resolve(await realpath(dirname(path)), basename(path));
  });
  if (canonical.split(sep).some(part => part === 'public' || part === '.next')) {
    throw new Error('Private review files must stay outside publicly served directories.');
  }
}

/** Local, read-only preparation. This cannot write a registry record, upload or adopt a job. */
export async function buildNano21PrivateReview(input: unknown): Promise<string> {
  const draft = draftSchema.parse(input);
  const paths = [draft.media.originalFile, draft.media.displayFile, draft.provenance.responseFile];
  for (const path of paths) await assertPrivateReviewPath(path);
  const [original, display, response] = await Promise.all(paths.map(path => readFile(path)));
  const [originalMeta, displayMeta] = await Promise.all([sharp(original).metadata(), sharp(display).metadata()]);
  if (![originalMeta, displayMeta].every(meta => ['png', 'jpeg', 'webp'].includes(meta.format ?? '') && meta.width && meta.height)) {
    throw new Error('Review requires decodable still images.');
  }
  const native = JSON.parse(response.toString('utf8')) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> };
  const hasSelectedOriginal = native.candidates?.some(candidate => candidate.content?.parts?.some(part =>
    part.inlineData?.data && Buffer.from(part.inlineData.data, 'base64').equals(original)));
  if (!hasSelectedOriginal) throw new Error('The selected original must match an image part in the supplied native response.');
  const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const manifest = { id: draft.id, status: draft.status, modelId: draft.modelId, version: draft.version,
    settings: draft.settings, provenance: { kind: draft.provenance.kind, location: draft.provenance.location, generatedAt: draft.provenance.generatedAt,
      promptSha256: sha(draft.prompt), responseSha256: sha(response) },
    original: { sha256: sha(original), width: originalMeta.width, height: originalMeta.height },
    display: { sha256: sha(display), width: displayMeta.width, height: displayMeta.height } };
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>Private Nano21 draft review</title><style>body{max-width:1100px;margin:40px auto;padding:20px;font:16px system-ui}img{width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
<h1>Private Nano21 draft review</h1><p>Review only. No public recipe, app job, customer quote or acceptance is created.</p>
<img src="data:image/${displayMeta.format === 'jpeg' ? 'jpeg' : displayMeta.format};base64,${display.toString('base64')}" alt="Private draft still">
<h2>Exact English prompt</h2><pre>${escape(draft.prompt)}</pre><h2>Measured local evidence</h2><pre>${escape(JSON.stringify(manifest, null, 2))}</pre></html>`;
}
