import promptingSourceDocument from '@/config/agent-model-prompting-sources.json' with { type: 'json' };
import { getModelRegistryEntries } from '@/config/model-registry';

import {
  CANONICAL_GENERATION_MODES,
  type CanonicalGenerationMode,
} from './generation-types';

export type AgentModelPromptingSource = Readonly<{
  id: string;
  kind: 'official_provider';
  provider: string;
  title: string;
  url: string;
  modes: readonly CanonicalGenerationMode[];
  reviewedAt: string;
}>;

export type AgentModelPromptingSourceRecord = AgentModelPromptingSource & Readonly<{
  modelIds: readonly string[];
}>;

const ENTRY_FIELDS = new Set([
  'id',
  'provider',
  'title',
  'url',
  'modelIds',
  'modes',
  'reviewedAt',
]);
const OFFICIAL_HOSTS = new Set([
  'ai.google.dev',
  'cloud.google.com',
  'developers.openai.com',
  'docs.byteplus.com',
  'docs.ltx.io',
  'docs.lumalabs.ai',
  'platform.minimax.io',
]);
const GENERATION_MODES = new Set<string>(CANONICAL_GENERATION_MODES);
const MAX_TEXT_LENGTH = 180;

function fail(message: string): never {
  throw new Error(`[agent-model-prompting-sources] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireText(value: unknown, path: string, maximum = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string') fail(`${path} must be a string`);
  if (!value || value !== value.trim() || value !== value.normalize('NFC')) {
    fail(`${path} must be non-empty, trimmed NFC text`);
  }
  if (value.length > maximum) fail(`${path} is too long`);
  return value;
}

function requireTextList(value: unknown, path: string, maximum: number): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    fail(`${path} must contain between 1 and ${maximum} items`);
  }
  const items = value.map((item, index) => requireText(item, `${path}[${index}]`, 128));
  if (new Set(items).size !== items.length) fail(`${path} contains duplicates`);
  return Object.freeze(items);
}

function requireUrl(value: unknown, path: string): string {
  const url = requireText(value, path, 500);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    fail(`${path} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:' || !OFFICIAL_HOSTS.has(parsed.hostname)) {
    fail(`${path} must use an allowlisted official HTTPS host`);
  }
  if (parsed.username || parsed.password || parsed.hash) fail(`${path} must not contain credentials or fragments`);
  return url;
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

export function parseAgentModelPromptingSources(
  value: unknown,
  knownEngineIds: ReadonlySet<string>,
): readonly AgentModelPromptingSourceRecord[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24) {
    fail('document must contain between 1 and 24 records');
  }

  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  const sourceCountByModel = new Map<string, number>();
  const records = value.map((entry, index) => {
    const path = `sources[${index}]`;
    if (!isRecord(entry)) fail(`${path} must be an object`);
    for (const key of Object.keys(entry)) {
      if (!ENTRY_FIELDS.has(key)) fail(`${path} contains unknown field ${key}`);
    }
    for (const key of ENTRY_FIELDS) {
      if (!(key in entry)) fail(`${path} is missing ${key}`);
    }

    const id = requireText(entry.id, `${path}.id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(`${path}.id must be kebab-case`);
    if (sourceIds.has(id)) fail(`duplicate source ID ${id}`);
    sourceIds.add(id);

    const url = requireUrl(entry.url, `${path}.url`);
    if (sourceUrls.has(url)) fail(`duplicate source URL ${url}`);
    sourceUrls.add(url);

    const modelIds = requireTextList(entry.modelIds, `${path}.modelIds`, 12);
    for (const modelId of modelIds) {
      if (!knownEngineIds.has(modelId)) fail(`${path}.modelIds contains unknown model ${modelId}`);
      const nextCount = (sourceCountByModel.get(modelId) ?? 0) + 1;
      if (nextCount > 3) fail(`${modelId} has more than 3 prompting sources`);
      sourceCountByModel.set(modelId, nextCount);
    }

    const modes = requireTextList(entry.modes, `${path}.modes`, CANONICAL_GENERATION_MODES.length);
    if (modes.some((mode) => !GENERATION_MODES.has(mode))) {
      fail(`${path}.modes contains an unsupported generation mode`);
    }

    return Object.freeze({
      id,
      kind: 'official_provider' as const,
      provider: requireText(entry.provider, `${path}.provider`, 80),
      title: requireText(entry.title, `${path}.title`),
      url,
      modelIds,
      modes: modes as readonly CanonicalGenerationMode[],
      reviewedAt: requireReviewDate(entry.reviewedAt, `${path}.reviewedAt`),
    });
  });

  return Object.freeze(records);
}

const knownEngineIds = new Set(getModelRegistryEntries().map((entry) => entry.id));
const records = parseAgentModelPromptingSources(promptingSourceDocument, knownEngineIds);
const recordsByModelId = new Map<string, AgentModelPromptingSourceRecord[]>();
for (const record of records) {
  for (const modelId of record.modelIds) {
    const existing = recordsByModelId.get(modelId) ?? [];
    existing.push(record);
    recordsByModelId.set(modelId, existing);
  }
}

export function listAgentModelPromptingSourceRecords(): readonly AgentModelPromptingSourceRecord[] {
  return Object.freeze([...records]);
}

export function getAgentModelPromptingSources(engineId: string): readonly AgentModelPromptingSource[] {
  return Object.freeze((recordsByModelId.get(engineId) ?? []).map((record) => Object.freeze({
    id: record.id,
    kind: record.kind,
    provider: record.provider,
    title: record.title,
    url: record.url,
    modes: Object.freeze([...record.modes]),
    reviewedAt: record.reviewedAt,
  })));
}
