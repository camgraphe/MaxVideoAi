import guidanceDocument from '@/config/agent-model-guidance.json' with { type: 'json' };
import { getModelRegistryEntries } from '@/config/model-registry';

export type AgentModelUseCase =
  | 'cinematic_story'
  | 'multi_shot'
  | 'product_video'
  | 'character_scene'
  | 'reference_guided'
  | 'source_edit'
  | 'conversational_refine'
  | 'social_video'
  | 'native_audio'
  | 'high_resolution';

export type AgentModelGuidance = Readonly<{
  engineId: string;
  strengths: readonly string[];
  bestFor: readonly AgentModelUseCase[];
  considerations: readonly string[];
  evidenceUrls: readonly string[];
  reviewedAt: string;
}>;

const USE_CASES = new Set<AgentModelUseCase>([
  'cinematic_story',
  'multi_shot',
  'product_video',
  'character_scene',
  'reference_guided',
  'source_edit',
  'conversational_refine',
  'social_video',
  'native_audio',
  'high_resolution',
]);
const ENTRY_FIELDS = new Set([
  'engineId',
  'strengths',
  'bestFor',
  'considerations',
  'evidenceUrls',
  'reviewedAt',
]);
const MAX_TEXT_LENGTH = 280;

function fail(message: string): never {
  throw new Error(`[agent-model-guidance] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireText(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(`${path} must be a string`);
  if (!value || value !== value.trim() || value !== value.normalize('NFC')) {
    fail(`${path} must be non-empty, trimmed NFC text`);
  }
  if (value.length > MAX_TEXT_LENGTH) fail(`${path} is too long`);
  return value;
}

function requireTextList(value: unknown, path: string, maximum: number): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    fail(`${path} must contain between 1 and ${maximum} items`);
  }
  const items = value.map((item, index) => requireText(item, `${path}[${index}]`));
  if (new Set(items).size !== items.length) fail(`${path} contains duplicates`);
  return Object.freeze(items);
}

function requireUseCases(value: unknown, path: string): readonly AgentModelUseCase[] {
  const items = requireTextList(value, path, 5);
  if (items.some((item) => !USE_CASES.has(item as AgentModelUseCase))) {
    fail(`${path} contains an unsupported use case`);
  }
  return items as readonly AgentModelUseCase[];
}

function requireEvidenceUrls(value: unknown, path: string): readonly string[] {
  const urls = requireTextList(value, path, 4);
  for (const url of urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      fail(`${path} contains an invalid URL`);
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'maxvideoai.com') {
      fail(`${path} must contain owned HTTPS URLs`);
    }
  }
  return urls;
}

function requireReviewDate(value: unknown, path: string): string {
  const date = requireText(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`${path} must use YYYY-MM-DD`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    fail(`${path} must be a valid calendar date`);
  }
  return date;
}

export function parseAgentModelGuidance(
  value: unknown,
  knownEngineIds: ReadonlySet<string>,
): readonly AgentModelGuidance[] {
  if (!Array.isArray(value)) fail('document must be an array');

  const engineIds = new Set<string>();
  const entries = value.map((entry, index) => {
    const path = `guidance[${index}]`;
    if (!isRecord(entry)) fail(`${path} must be an object`);
    for (const key of Object.keys(entry)) {
      if (!ENTRY_FIELDS.has(key)) fail(`${path} contains unknown field ${key}`);
    }
    for (const key of ENTRY_FIELDS) {
      if (!(key in entry)) fail(`${path} is missing ${key}`);
    }

    const engineId = requireText(entry.engineId, `${path}.engineId`);
    if (!knownEngineIds.has(engineId)) fail(`${path}.engineId is not a known engine`);
    if (engineIds.has(engineId)) fail(`duplicate engine ID ${engineId}`);
    engineIds.add(engineId);

    return Object.freeze({
      engineId,
      strengths: requireTextList(entry.strengths, `${path}.strengths`, 4),
      bestFor: requireUseCases(entry.bestFor, `${path}.bestFor`),
      considerations: requireTextList(entry.considerations, `${path}.considerations`, 4),
      evidenceUrls: requireEvidenceUrls(entry.evidenceUrls, `${path}.evidenceUrls`),
      reviewedAt: requireReviewDate(entry.reviewedAt, `${path}.reviewedAt`),
    });
  });

  return Object.freeze(entries);
}

const knownEngineIds = new Set(getModelRegistryEntries().map((entry) => entry.id));
const guidance = parseAgentModelGuidance(guidanceDocument, knownEngineIds);
const guidanceByEngineId = new Map(guidance.map((entry) => [entry.engineId, entry]));

export function listAgentModelGuidance(): readonly AgentModelGuidance[] {
  return Object.freeze([...guidance]);
}

export function getAgentModelGuidance(engineId: string): AgentModelGuidance | null {
  return guidanceByEngineId.get(engineId) ?? null;
}
