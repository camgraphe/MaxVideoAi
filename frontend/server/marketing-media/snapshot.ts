import { createHash } from 'node:crypto';
import type { MarketingMediaFile } from '@/lib/marketing-media';

type RecordValue = Record<string, unknown>;
export type MarketingSource = { job: RecordValue; output?: RecordValue | null };
export type MarketingCopyPlan = {
  videoId: string; ownerId: string | null; fingerprint: string;
  publication: RecordValue; recreationSnapshot: RecordValue; sourceSnapshot: RecordValue;
  media: { sourceUrl: string; kind: 'image' | 'video' | 'audio'; role: string }[];
};
export class MarketingMediaError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'MarketingMediaError'; }
}
export const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const portableRefKeys = new Set(['assetId', 'sourceOutputId', 'sourceJobId', 'userId', 'ownerId', 'jobId']);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  return value;
}
export const marketingSourceFingerprint = (source: MarketingSource) => createHash('sha256').update(JSON.stringify(canonical(source))).digest('hex');

function safeReference(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeReference);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key])=>!portableRefKeys.has(key)).map(([key,item])=>[key,safeReference(item)]));
  return value;
}

/** Capture generation inputs, not billing/provider execution records. No defaults are invented. */
export function prepareMarketingSnapshot(source: MarketingSource): MarketingCopyPlan {
  const job = source.job;
  if (job.status !== 'completed' || (job.surface && job.surface !== 'video')) throw new MarketingMediaError('Only completed videos can be copied.');
  const saved = record(job.settings_snapshot);
  if (saved.schemaVersion !== 1 || saved.surface !== 'video' || saved.engineId !== job.engine_id || typeof saved.prompt !== 'string'
    || !saved.core || !saved.refs || !saved.inputMode) throw new MarketingMediaError('Complete generation settings are missing. Restore the source settings before copying.');
  const extra = record(record(saved.advanced).extraInputValues);
  if (extra.previous_interaction_id) throw new MarketingMediaError('This video depends on a provider interaction. Its complete inputs must be restored before copying.');
  if (Object.keys(extra).some(key=>/secret|password|credential|authorization|api.?key/i.test(key))) throw new MarketingMediaError('Generation settings contain private credentials and cannot be published.');
  const recreationSnapshot: RecordValue = Object.fromEntries(['schemaVersion','surface','engineId','engineLabel','inputMode','prompt','negativePrompt','core','advanced','refs'].filter(key=>key in saved).map(key=>[key,structuredClone(saved[key])]));
  recreationSnapshot.refs = safeReference(recreationSnapshot.refs);
  const publication: RecordValue = Object.fromEntries(['job_id','engine_id','engine_label','duration_sec','prompt','thumb_url','video_url','preview_video_url','keyframe_urls','aspect_ratio','has_audio','can_upscale','created_at','visibility','indexable','featured','featured_order','final_price_cents','currency','pricing_snapshot'].filter(key=>key in job).map(key=>[key,structuredClone(job[key])]));
  publication.prompt = saved.prompt;
  publication.user_id = null;
  publication.status = 'completed'; publication.surface = 'video';
  const media = new Map<string, MarketingCopyPlan['media'][number]>();
  function add(value: unknown, role: string, kind: 'image' | 'video' | 'audio') {
    if (value == null || value === '') return;
    if (typeof value !== 'string') throw new MarketingMediaError('Invalid media reference.');
    let parsed: URL;
    try { parsed = new URL(value); } catch { throw new MarketingMediaError('A media reference is unavailable.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) throw new MarketingMediaError('A media reference is not a portable HTTPS source.');
    if (!media.has(value)) media.set(value, { sourceUrl: value, role, kind });
    if (media.size > 64) throw new MarketingMediaError('This video has too many media references to copy together.');
  }
  function visit(value: unknown, path: string, kind: 'image' | 'video' | 'audio' = 'image') {
    if (Array.isArray(value)) { value.forEach(item=>visit(item,path,kind)); return; }
    if (value && typeof value === 'object') {
      const ownKind = record(value).kind;
      const hint = ownKind === 'video' || ownKind === 'audio' ? ownKind : kind;
      for (const [key,item] of Object.entries(value)) visit(item,`${path}.${key}`,/video/i.test(key) ? 'video' : /audio/i.test(key) ? 'audio' : hint);
      return;
    }
    if (typeof value === 'string' && (/^(https?:|blob:|data:|file:)/i.test(value) || /url(s)?$/i.test(path))) add(value,path,kind);
  }
  if (!text(job.video_url) || !text(job.job_id)) throw new MarketingMediaError('The original video is missing.');
  add(job.video_url,'original','video'); add(job.thumb_url,'poster','image'); add(job.preview_video_url,'preview','video');
  add(source.output?.playback_video_url ?? job.playback_video_url,'playback','video');
  visit(job.keyframe_urls,'keyframes');
  visit(recreationSnapshot.refs,'refs');
  for (const [key,value] of Object.entries(extra)) if (/url(s)?$/i.test(key)) visit(value,`advanced.extraInputValues.${key}`,/video/i.test(key) ? 'video' : /audio/i.test(key) ? 'audio' : 'image');
  publication.settings_snapshot = { ...recreationSnapshot, marketingMedia: {
    outputWidth: source.output?.width ?? null, outputHeight: source.output?.height ?? null,
    playbackVideoUrl: source.output?.playback_video_url ?? job.playback_video_url ?? null,
  } };
  return { videoId: text(job.job_id), ownerId: text(job.user_id) || null, fingerprint: marketingSourceFingerprint(source), publication,
    recreationSnapshot, sourceSnapshot: structuredClone(saved), media: [...media.values()] };
}

export function completeMarketingSnapshot(plan: MarketingCopyPlan, copies: MarketingMediaFile[]) {
  const map = new Map(copies.map(copy=>[copy.sourceUrl,copy]));
  if (plan.media.some(item=>!map.get(item.sourceUrl)?.key.startsWith('marketing-media/') || !map.get(item.sourceUrl)?.url.startsWith('https://')
    || !(map.get(item.sourceUrl)!.sizeBytes > 0) || !/^[a-f0-9]{64}$/.test(map.get(item.sourceUrl)!.sha256))) throw new MarketingMediaError('The marketing copy is incomplete.', 409);
  function rewrite(value: unknown, key = ''): unknown {
    if (typeof value === 'string') return ['prompt','negativePrompt','name','label','description'].includes(key) ? value : map.get(value)?.url ?? value;
    if (Array.isArray(value)) return value.map(item=>rewrite(item,key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,rewrite(item,name)]));
    return value;
  }
  return { publication: rewrite(plan.publication) as RecordValue, recreationSnapshot: rewrite(plan.recreationSnapshot) as RecordValue,
    files: plan.media.map(item=>map.get(item.sourceUrl)!), sizeBytes: plan.media.reduce((sum,item)=>sum+map.get(item.sourceUrl)!.sizeBytes,0) };
}
