import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { buildFlux3MaxFalRequest } from '../../src/lib/flux-3-max';
import type { GeneratePayload } from '../../src/lib/fal-types';

const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
const referenceSchema = z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), frameIndex: z.number().int().nonnegative().optional() }).strict();
const sceneSchema = z.object({
  id: idSchema, title: z.string().min(1), mode: z.enum(['t2v', 'i2v', 'fl2v', 'ref2v']), prompt: z.string().trim().min(1),
  durationSec: z.number().int().min(5).max(20), resolution: z.enum(['720p', '1080p']),
  aspectRatio: z.enum(['auto', '21:9', '2:1', '16:9', '4:3', '1:1', '3:4', '9:16']),
  audio: z.boolean(), reasoningLevel: z.enum(['low', 'high']), seed: z.number().int().safe().optional(),
  references: z.array(referenceSchema).max(10).default([]),
}).strict();
const manifestSchema = z.object({ schemaVersion: z.literal(1), jobs: z.array(sceneSchema).min(1).max(50) }).strict();
type DirectScene = z.infer<typeof sceneSchema>;
export type DirectQuote = {
  schemaVersion: 1; billing: 'direct-fal-no-maxvideoai-charge'; quotedAt: string; expiresAt: string;
  priceBasis: 'fal-promotional' | 'fal-list'; providerEstimateUsd: number; providerListUsd: number;
  jobs: Array<DirectScene & { endpoint: string; providerEstimateUsd: number; providerListUsd: number }>;
  quoteSha256: string;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
function usd(micro: number): number { return micro / 1_000_000; }
function quoteBody(quote: DirectQuote) { return Object.fromEntries(Object.entries(quote).filter(([key]) => key !== 'quoteSha256')); }
async function referenceBytes(reference: z.infer<typeof referenceSchema>): Promise<Buffer> {
  if (!path.isAbsolute(reference.path) || !/\.(png|jpe?g|webp)$/i.test(reference.path)) throw new Error('REFERENCE_PATH_INVALID');
  const bytes = await readFile(reference.path);
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('REFERENCE_SIZE_INVALID');
  if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) throw new Error('REFERENCE_HASH_MISMATCH');
  return bytes;
}
function requestFor(scene: DirectScene, urls: string[]) {
  if (scene.mode === 't2v' && urls.length !== 0
    || scene.mode === 'i2v' && urls.length !== 1
    || scene.mode === 'fl2v' && urls.length !== 2
    || scene.mode === 'ref2v' && urls.length < 1) throw new Error('REFERENCE_COUNT_INVALID');
  if (scene.mode !== 'ref2v' && scene.references.some(r => r.frameIndex !== undefined)) throw new Error('FRAME_INDEX_NOT_APPLICABLE');
  const payload = {
    engineId: 'flux-3-max', mode: scene.mode, prompt: scene.prompt, durationSec: scene.durationSec,
    resolution: scene.resolution, aspectRatio: scene.aspectRatio, audio: scene.audio, seed: scene.seed,
    extraInputValues: { reasoning_level: scene.reasoningLevel,
      ...(scene.mode === 'ref2v' ? { keyframe_indexes: scene.references.map(r => r.frameIndex).join(',') } : {}) },
    ...(scene.mode === 'ref2v' ? { referenceImages: urls } : scene.mode !== 't2v' ? { imageUrl: urls[0], ...(urls[1] ? { endImageUrl: urls[1] } : {}) } : {}),
  } as GeneratePayload;
  return buildFlux3MaxFalRequest(payload);
}

/** Pure planning plus local image digest checks. No credential or provider access. */
export async function prepareDirectQuote(input: unknown, now = new Date()): Promise<DirectQuote> {
  const manifest = manifestSchema.parse(input);
  if (new Set(manifest.jobs.map(j => j.id)).size !== manifest.jobs.length) throw new Error('DUPLICATE_SCENE_ID');
  // Fal omits a timezone for the promotion's end. Stop using it before Nov 7 anywhere.
  const promoStart = Date.parse('2026-10-16T00:00:00Z');
  const promoSafeEnd = Date.parse('2026-11-06T00:00:00Z');
  const promotional = now.getTime() >= promoStart && now.getTime() < promoSafeEnd;
  const jobs = [];
  for (const scene of manifest.jobs) {
    for (const reference of scene.references) await referenceBytes(reference);
    const { model } = requestFor(scene, scene.references.map((_, i) => `https://reference.invalid/${i}.png`));
    const listMicros = scene.durationSec * (scene.resolution === '720p' ? 170_000 : 290_000);
    jobs.push({ ...scene, endpoint: model, providerEstimateUsd: usd(promotional ? listMicros / 4 : listMicros), providerListUsd: usd(listMicros) });
  }
  const body = {
    schemaVersion: 1 as const, billing: 'direct-fal-no-maxvideoai-charge' as const,
    quotedAt: now.toISOString(), expiresAt: new Date(Math.min(now.getTime() + 24 * 60 * 60 * 1000, promotional ? promoSafeEnd : Infinity)).toISOString(),
    priceBasis: promotional ? 'fal-promotional' as const : 'fal-list' as const,
    providerEstimateUsd: usd(jobs.reduce((sum, j) => sum + Math.round(j.providerEstimateUsd * 1_000_000), 0)),
    providerListUsd: usd(jobs.reduce((sum, j) => sum + Math.round(j.providerListUsd * 1_000_000), 0)), jobs,
  };
  return { ...body, quoteSha256: digest(body) };
}

async function appendJournal(file: string, entry: Record<string, unknown>): Promise<void> {
  const handle = await open(file, 'a', 0o600);
  try { await handle.write(JSON.stringify(entry) + '\n'); await handle.sync(); } finally { await handle.close(); }
}
type SubmitProvider = {
  upload(bytes: Buffer, filename: string): Promise<string>;
  submit(endpoint: string, input: Record<string, unknown>): Promise<{ request_id: string }>;
};
export async function submitDirectJob(options: {
  quote: DirectQuote; jobId: string; stateDir: string; approvedQuoteSha256: string; maxProviderUsd: number; now?: Date;
}, provider: SubmitProvider): Promise<{ requestId: string; endpoint: string; journalPath: string }> {
  const { quote } = options;
  const now = options.now ?? new Date();
  if (digest(quoteBody(quote)) !== quote.quoteSha256 || options.approvedQuoteSha256 !== quote.quoteSha256) throw new Error('QUOTE_APPROVAL_REQUIRED');
  if (!(now.getTime() >= Date.parse(quote.quotedAt) && now.getTime() < Date.parse(quote.expiresAt))) throw new Error('QUOTE_EXPIRED');
  // Recompute every setting, reference digest and amount; a modified quote cannot lower its cap.
  const checked = await prepareDirectQuote({ schemaVersion: 1, jobs: quote.jobs.map(job => Object.fromEntries(Object.entries(job)
    .filter(([key]) => !['endpoint', 'providerEstimateUsd', 'providerListUsd'].includes(key)))) }, new Date(quote.quotedAt));
  if (checked.quoteSha256 !== quote.quoteSha256) throw new Error('QUOTE_INVALID');
  if (!Number.isFinite(options.maxProviderUsd) || options.maxProviderUsd < quote.providerEstimateUsd) throw new Error('BUDGET_TOO_SMALL');
  const scene = quote.jobs.find(j => j.id === options.jobId);
  if (!scene) throw new Error('SCENE_NOT_IN_QUOTE');
  await mkdir(options.stateDir, { recursive: true, mode: 0o700 });
  const journalPath = path.join(options.stateDir, scene.id + '.jsonl');
  let handle;
  try { handle = await open(journalPath, 'wx', 0o600); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('ATTEMPT_ALREADY_EXISTS_RECOVER_DO_NOT_RESUBMIT');
    throw error;
  }
  try {
    await handle.write(JSON.stringify({ event: 'attempt_reserved', at: now.toISOString(), quoteSha256: quote.quoteSha256,
      endpoint: scene.endpoint, scene, billing: quote.billing, approvedMaxProviderUsd: options.maxProviderUsd }) + '\n');
    await handle.sync();
  } finally { await handle.close(); }
  const urls: string[] = [];
  try {
    for (const reference of scene.references) {
      const url = await provider.upload(await referenceBytes(reference), path.basename(reference.path));
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('REFERENCE_UPLOAD_URL_INVALID');
      urls.push(url);
      await appendJournal(journalPath, { event: 'reference_uploaded', index: urls.length - 1, sha256: reference.sha256, url });
    }
    const { model, requestBody } = requestFor(scene, urls);
    await appendJournal(journalPath, { event: 'submission_started', at: new Date().toISOString(), endpoint: model, input: requestBody });
    const accepted = await provider.submit(model, requestBody);
    if (typeof accepted.request_id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(accepted.request_id)) throw new Error('ACKNOWLEDGEMENT_INVALID');
    try { await appendJournal(journalPath, { event: 'accepted', requestId: accepted.request_id, at: new Date().toISOString() }); }
    catch { throw new Error(`ACK_PERSIST_FAILED_REQUEST_ID_${accepted.request_id}`); }
    return { requestId: accepted.request_id, endpoint: model, journalPath };
  } catch (error) {
    await appendJournal(journalPath, { event: 'stopped_requires_review', at: new Date().toISOString(), retryAllowed: false }).catch(() => undefined);
    if (error instanceof Error && error.message.startsWith('ACK_PERSIST_FAILED_REQUEST_ID_')) throw error;
    throw new Error('ATTEMPT_STOPPED_RECOVER_PROVIDER_STATE_DO_NOT_RESUBMIT');
  }
}

export async function recoverDirectJob(options: { stateDir: string; jobId: string }, provider: {
  status(endpoint: string, requestId: string): Promise<{ status: string }>;
  result(endpoint: string, requestId: string): Promise<unknown>;
}): Promise<{ requestId: string; endpoint: string; status: string; result?: unknown }> {
  idSchema.parse(options.jobId);
  const journalPath = path.join(options.stateDir, options.jobId + '.jsonl');
  const entries = (await readFile(journalPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const intent = entries.find(e => e.event === 'submission_started');
  const ack = entries.find(e => e.event === 'accepted');
  if (!intent?.endpoint || !ack?.requestId) throw new Error('REQUEST_ID_MISSING_REVIEW_FAL_HISTORY_NO_AUTOMATIC_RETRY');
  const status = await provider.status(intent.endpoint, ack.requestId);
  const result = status.status === 'COMPLETED' ? await provider.result(intent.endpoint, ack.requestId) : undefined;
  await appendJournal(journalPath, { event: 'recovered', at: new Date().toISOString(), requestId: ack.requestId, status: status.status, ...(result ? { result } : {}) });
  return { requestId: ack.requestId, endpoint: intent.endpoint, status: status.status, ...(result ? { result } : {}) };
}

/** The SDK's queue config overrides retry.maxRetries. Fence POST at the transport. */
export function createSingleSubmissionFetch(fetcher: typeof fetch = fetch): typeof fetch {
  let queuePostStarted = false;
  return async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const paidPost = url.hostname === 'queue.fal.run' && method === 'POST';
    if (paidPost) {
      if (queuePostStarted) throw new Error('SUBMISSION_RETRY_BLOCKED');
      if (!/^\/blackforestlabs\/flux-3-max\/(text-to-video|image-to-video|keyframes-to-video)\/?$/.test(url.pathname) || url.search) throw new Error('SUBMISSION_ENDPOINT_INVALID');
      queuePostStarted = true;
    }
    const response = await fetcher(input, { ...init, redirect: 'error' });
    // Plain Error avoids the SDK's retryable ApiError branch after an ambiguous HTTP response.
    if (paidPost && !response.ok) throw new Error(`SUBMISSION_HTTP_${response.status}`);
    return response;
  };
}

export type DirectPriceEvidence = {
  checkedAt: string;
  prices: Array<{ endpoint_id: string; unit_price: number; unit: string; currency: string }>;
  publicRates: Array<{ endpoint: string; usdPerSecond720p: number; usdPerSecond1080p: number; sourceUrl: string }>;
};
const DIRECT_ENDPOINTS = ['text-to-video', 'image-to-video', 'keyframes-to-video'].map(mode => 'blackforestlabs/flux-3-max/' + mode);

/** Authenticated GET plus public documentation GETs only; never queues inference. */
export async function readDirectPriceEvidence(credentials: string, fetcher: typeof fetch = fetch): Promise<DirectPriceEvidence> {
  const url = new URL('https://api.fal.ai/v1/models/pricing');
  for (const endpoint of DIRECT_ENDPOINTS) url.searchParams.append('endpoint_id', endpoint);
  const response = await fetcher(url, { headers: { Authorization: 'Key ' + credentials }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('PRICING_HTTP_' + response.status);
  const data = await response.json();
  const prices = z.array(z.object({ endpoint_id: z.string(), unit_price: z.number().nonnegative(), unit: z.string(), currency: z.string() })).parse(data.prices);
  if (data.has_more || prices.length !== 3 || new Set(prices.map(p => p.endpoint_id)).size !== 3) throw new Error('PROVIDER_PRICE_UNVERIFIED');
  const publicRates = [];
  for (const endpoint of DIRECT_ENDPOINTS) {
    const sourceUrl = 'https://fal.ai/models/' + endpoint;
    const page = await fetcher(sourceUrl, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (!page.ok) throw new Error('PUBLIC_PRICING_HTTP_' + page.status);
    const html = (await page.text()).replaceAll('**', '');
    const matches = [...html.matchAll(/Video costs \$([0-9.]+) per second at 720p and \$([0-9.]+) per second at 1080p/g)];
    if (!matches.length || matches.some(m => m[1] !== matches[0][1] || m[2] !== matches[0][2])) throw new Error('PUBLIC_PRICE_UNVERIFIED');
    publicRates.push({ endpoint, usdPerSecond720p: Number(matches[0][1]), usdPerSecond1080p: Number(matches[0][2]), sourceUrl });
  }
  return { checkedAt: new Date().toISOString(), prices, publicRates };
}

export function assertDirectPricesUnchanged(quote: DirectQuote, approved: DirectPriceEvidence, current: DirectPriceEvidence): void {
  const checkedAt = Date.parse(current.checkedAt);
  const approvedAt = Date.parse(approved.checkedAt);
  if (!Number.isFinite(checkedAt) || !Number.isFinite(approvedAt) || checkedAt < approvedAt || checkedAt - approvedAt > 24 * 60 * 60 * 1000) throw new Error('PRICE_EVIDENCE_EXPIRED');
  for (const job of quote.jobs) {
    const prior = approved.prices.find(p => p.endpoint_id === job.endpoint);
    const live = current.prices.find(p => p.endpoint_id === job.endpoint);
    const publicPrior = approved.publicRates.find(p => p.endpoint === job.endpoint);
    const publicLive = current.publicRates.find(p => p.endpoint === job.endpoint);
    if (!prior || !live || !publicPrior || !publicLive || [prior, live].some(p => p.unit !== 'seconds' || p.currency !== 'USD' || !Number.isFinite(p.unit_price) || p.unit_price <= 0)
      || [publicPrior, publicLive].some(p => !Number.isFinite(p.usdPerSecond720p) || p.usdPerSecond720p <= 0 || !Number.isFinite(p.usdPerSecond1080p) || p.usdPerSecond1080p <= 0)) throw new Error('PROVIDER_PRICE_UNVERIFIED');
    const field = job.resolution === '720p' ? 'usdPerSecond720p' : 'usdPerSecond1080p';
    if (live.unit_price > prior.unit_price || publicLive[field] > publicPrior[field]
      || Math.round(publicLive[field] * job.durationSec * 1_000_000) > Math.round(job.providerEstimateUsd * 1_000_000)) throw new Error('PROVIDER_PRICE_INCREASED');
  }
}
