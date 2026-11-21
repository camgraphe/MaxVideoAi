import { createHash } from 'node:crypto';
import { normalizeEngineId } from '@/lib/engine-alias';
import { publicExampleRequestedResolution } from '@/lib/example-recreation';
import { asArray, asRecord } from '@/server/watch-page-signals/normalization';
import type { GalleryVideo } from '@/server/videos';
import type { EngineCatalogEntry } from './compare-page-types';

export type SamePromptSelection = {
  promptHash: string;
  videoIds: readonly string[];
};

type ComparedEngine = Pick<EngineCatalogEntry, 'engineId' | 'modelSlug'>;

export type SamePromptClip = {
  id: string;
  model: string;
  videoUrl: string;
  posterUrl?: string;
  durationSec: number;
  generationMode?: GalleryVideo['generationMode'];
  requestedResolution?: string;
  width?: number | null;
  height?: number | null;
  aspectRatio?: string;
  hasAudio: boolean | null;
  createdAt: string | null;
};

export type SamePromptCase = {
  promptHash: string;
  prompt: string;
  clips: [SamePromptClip, SamePromptClip];
};

function normalizePrompt(value: unknown) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '').normalize('NFC') : '';
}

function promptFor(video: GalleryVideo) {
  return normalizePrompt(asRecord(video.settingsSnapshot)?.prompt) || normalizePrompt(video.prompt);
}

function multiPromptFor(video: GalleryVideo) {
  const advanced = asRecord(asRecord(video.settingsSnapshot)?.advanced);
  return asArray(advanced?.multiPrompt);
}

function isEngine(video: GalleryVideo, engine: ComparedEngine) {
  const id = normalizeEngineId(video.engineId) ?? video.engineId;
  return [engine.engineId, engine.modelSlug].some(candidate => (normalizeEngineId(candidate) ?? candidate) === id);
}

function publicClip(video: GalleryVideo): SamePromptClip | null {
  if (video.visibility !== 'public' || !video.indexable || !video.videoUrl) return null;
  const date = new Date(video.createdAt);
  const core = asRecord(asRecord(video.settingsSnapshot)?.core);
  return {
    id: video.id,
    model: video.engineLabel,
    videoUrl: video.videoUrl,
    posterUrl: video.thumbUrl,
    durationSec: video.durationSec,
    generationMode: video.generationMode,
    requestedResolution: video.requestedResolution ?? publicExampleRequestedResolution(core?.resolution) ?? undefined,
    width: video.outputWidth,
    height: video.outputHeight,
    aspectRatio: video.aspectRatio,
    hasAudio: video.hasAudio ? true : core?.audio === false ? false : null,
    createdAt: Number.isFinite(date.getTime()) ? date.toISOString() : null,
  };
}

export function selectSamePromptExamples(
  selections: readonly SamePromptSelection[],
  videos: ReadonlyMap<string, GalleryVideo>,
  left: ComparedEngine,
  right: ComparedEngine
): SamePromptCase[] {
  const cases: SamePromptCase[] = [];
  const seen = new Set<string>();

  for (const { promptHash, videoIds } of selections) {
    if (seen.has(promptHash) || videoIds.length !== 2 || videoIds[0] === videoIds[1]) continue;
    let a = videos.get(videoIds[0]);
    let b = videos.get(videoIds[1]);
    if (!a || !b) continue;
    if (isEngine(a, right) && isEngine(b, left)) [a, b] = [b, a];
    if (!isEngine(a, left) || !isEngine(b, right)) continue;

    const first = publicClip(a);
    const second = publicClip(b);
    if (!first || !second || first.videoUrl === second.videoUrl) continue;
    const prompt = promptFor(a);
    if (!prompt || prompt !== promptFor(b) || createHash('sha256').update(prompt).digest('hex') !== promptHash) continue;
    if (JSON.stringify(multiPromptFor(a)) !== JSON.stringify(multiPromptFor(b))) continue;

    cases.push({ promptHash, prompt, clips: [first, second] });
    seen.add(promptHash);
  }

  return cases;
}
