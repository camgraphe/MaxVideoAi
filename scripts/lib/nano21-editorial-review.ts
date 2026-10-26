import { z } from 'zod';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import { nano21EditorialRecipeFields } from '../../frontend/lib/nano21-editorial-recipes';

const file = z.string().refine(isAbsolute, 'Use an absolute private file path');
const draftSchema = nano21EditorialRecipeFields.omit({ status: true, media: true, provenance: true }).extend({
  status: z.literal('draft'),
  media: z.object({ originalFile: file, displayFile: file }).strict(),
  provenance: z.object({ kind: z.literal('external_vertex'), location: z.literal('global'),
    generatedAt: z.string().datetime(), responseFile: file }).strict(),
}).strict();

// Local review resource budgets, not provider/model capabilities or production quotas.
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 128 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 4096 * 4096;
const DECODE_TIMEOUT_SECONDS = 10;

export async function assertPrivateReviewPath(path: string): Promise<void> {
  if (!isAbsolute(path)) throw new Error('Use an absolute private review path.');
  const isServedPath = (candidate: string) => resolve(candidate).split(sep).some(part => part === 'public' || part === '.next');
  // An outward symlink must not erase a publicly served supplied pathname.
  if (isServedPath(path)) throw new Error('Private review files must stay outside publicly served directories.');
  const canonical = await realpath(path).catch(async () => {
    const { dirname, basename } = await import('node:path');
    return resolve(await realpath(dirname(path)), basename(path));
  });
  if (isServedPath(canonical)) {
    throw new Error('Private review files must stay outside publicly served directories.');
  }
}

async function readReviewFile(path: string, maxBytes: number): Promise<Buffer> {
  const facts = await stat(path);
  if (!facts.isFile() || facts.size > maxBytes) throw new Error('Private review input exceeds its local byte budget.');
  const bytes = await readFile(path);
  if (bytes.length > maxBytes) throw new Error('Private review input exceeds its local byte budget.');
  return bytes;
}

function hasPngAnimation(bytes: Buffer): boolean {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') return true;
    offset += 12 + length;
  }
  return false;
}

async function decodeReviewStill(bytes: Buffer) {
  const image = sharp(bytes, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS, animated: true });
  const metadata = await image.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || !metadata.width || !metadata.height
    || (metadata.pages ?? 1) !== 1 || metadata.loop !== undefined || (metadata.delay?.length ?? 0) > 0 || hasPngAnimation(bytes)) {
    throw new Error('Review requires a single-frame PNG, JPEG or WebP still image.');
  }
  // Metadata is insufficient: consume all decoded pixels under a fixed pixel/time budget.
  await image.timeout({ seconds: DECODE_TIMEOUT_SECONDS }).raw().toBuffer();
  return { width: metadata.width, height: metadata.height, mimeType: `image/${metadata.format}` };
}

/** Local, read-only preparation. This cannot write a registry record, upload or adopt a job. */
export async function buildNano21PrivateReview(input: unknown): Promise<string> {
  const draft = draftSchema.parse(input);
  const paths = [draft.media.originalFile, draft.media.displayFile, draft.provenance.responseFile];
  for (const path of paths) await assertPrivateReviewPath(path);
  const [original, display, response] = await Promise.all(paths.map((path, index) => readReviewFile(path, index === 2 ? MAX_RESPONSE_BYTES : MAX_IMAGE_BYTES)));
  const [originalMeta, displayMeta] = await Promise.all([decodeReviewStill(original), decodeReviewStill(display)]);
  const native = JSON.parse(response.toString('utf8')) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> };
  const hasSelectedOriginal = native.candidates?.some(candidate => candidate.content?.parts?.some(part =>
    part.inlineData?.data && Buffer.from(part.inlineData.data, 'base64').equals(original)));
  if (!hasSelectedOriginal) throw new Error('The selected original must match an image part in the supplied native response.');
  const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const declared = { id: draft.id, status: draft.status, modelId: draft.modelId, version: draft.version,
    settings: draft.settings, kind: draft.provenance.kind, location: draft.provenance.location, generatedAt: draft.provenance.generatedAt };
  const measured = { promptSha256: sha(draft.prompt), responseSha256: sha(response), suppliedResponseContainsOriginal: true,
    original: { sha256: sha(original), ...originalMeta }, display: { sha256: sha(display), ...displayMeta } };
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>Private Nano21 draft review</title><style>body{max-width:1100px;margin:40px auto;padding:20px;font:16px system-ui}img{width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
<h1>Private Nano21 draft review</h1><p>Review only. No public recipe, app job, customer quote or acceptance is created.</p>
<img src="data:${displayMeta.mimeType};base64,${display.toString('base64')}" alt="Private draft still">
<h2>Declared English prompt</h2><pre>${escape(draft.prompt)}</pre>
<h2>Declared production facts — not authenticated</h2><pre data-declared-facts>${escape(JSON.stringify(declared, null, 2))}</pre>
<h2>Measured local bytes</h2><pre data-measured-facts>${escape(JSON.stringify(measured, null, 2))}</pre>
<p>Image-part membership in the supplied response does not authenticate a native request, model/version, settings/date, finish reason or usage,
display-to-original transformation, or artistic acceptance. Those require separate evidence and review.</p></html>`;
}
