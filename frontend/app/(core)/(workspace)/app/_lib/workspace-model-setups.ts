import type { WorkspaceModelSetup } from './workspace-model-candidate';

export const MAX_WORKSPACE_MODEL_SETUP_BYTES = 1024 * 1024;
export type WorkspaceModelSetupError = 'invalid' | 'incomplete' | 'oversized';
export type WorkspaceSavedModelSetup = { modelId: string; updatedAt: number; setup: WorkspaceModelSetup };
export type WorkspaceModelSetupEntries = Record<string, unknown>;
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string';
const http = (value: unknown): value is string => {
  if (!text(value)) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const bytes = (value: string) => new TextEncoder().encode(value).length;
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 20) return false;
  if (value === null || typeof value === 'boolean' || finite(value)) return true;
  if (text(value)) return !value.startsWith('blob:');
  if (Array.isArray(value)) return value.every((entry) => jsonValue(entry, depth + 1));
  return (
    object(value) &&
    Object.entries(value).every(
      ([key, entry]) =>
        !/^(access_token|refresh_token|authorization|password|token)$/i.test(key) &&
        jsonValue(entry, depth + 1),
    )
  );
}
function asset(value: unknown, fieldId?: string): unknown {
  if (value === null) return null;
  if (
    !object(value) ||
    !text(value.id) ||
    !text(value.name) ||
    !text(value.kind) ||
    !['image', 'video', ...(fieldId ? ['audio'] : [])].includes(value.kind) ||
    value.status !== 'ready' ||
    !http(value.url)
  )
    throw new Error('incomplete');
  if (fieldId && (value.fieldId !== fieldId || !text(value.type) || !finite(value.size) || value.size < 0))
    throw new Error('invalid');
  const result: Record<string, unknown> = {};
  for (const key of [
    'id',
    'name',
    'kind',
    'status',
    'url',
    'assetId',
    ...(fieldId ? ['fieldId', 'type', 'size', 'width', 'height', 'durationSec'] : []),
  ]) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  if (result.assetId !== undefined && !text(result.assetId)) throw new Error('invalid');
  for (const key of ['width', 'height', 'durationSec'])
    if (
      result[key] !== undefined &&
      result[key] !== null &&
      (!finite(result[key]) || (result[key] as number) < 0)
    )
      throw new Error('invalid');
  result.previewUrl = http(value.previewUrl) ? value.previewUrl : value.url;
  return result;
}
/** Strict, complete private-draft serializer. No storage, auth token, File or temporary URL. */
export function serializeWorkspaceModelSetup(
  value: unknown,
): { ok: true; setup: WorkspaceModelSetup } | { ok: false; error: WorkspaceModelSetupError } {
  try {
    if (
      !object(value) ||
      !object(value.form) ||
      !object(value.inputAssets) ||
      !Array.isArray(value.klingElements) ||
      !Array.isArray(value.multiPromptScenes)
    )
      throw new Error('invalid');
    const f = value.form;
    if (
      !text(f.engineId) ||
      !f.engineId ||
      !text(f.mode) ||
      ![
        't2v',
        'i2v',
        'r2v',
        'ref2v',
        'fl2v',
        'reframe',
        'a2v',
        'v2v',
        'extend',
        'retake',
        't2i',
        'i2i',
      ].includes(f.mode) ||
      !text(f.resolution) ||
      !text(f.aspectRatio) ||
      typeof f.audio !== 'boolean' ||
      !object(f.extraInputValues) ||
      !jsonValue(f.extraInputValues)
    )
      throw new Error('invalid');
    for (const key of ['durationSec', 'fps', 'iterations'])
      if (!finite(f[key]) || f[key] <= 0) throw new Error('invalid');
    for (const key of ['seedLocked', 'loop', 'cameraFixed', 'safetyChecker'])
      if (f[key] !== undefined && typeof f[key] !== 'boolean') throw new Error('invalid');
    for (const key of ['seed', 'numFrames'])
      if (f[key] !== undefined && f[key] !== null && !finite(f[key])) throw new Error('invalid');
    if (
      f.durationOption !== undefined &&
      f.durationOption !== null &&
      !finite(f.durationOption) &&
      !text(f.durationOption)
    )
      throw new Error('invalid');
    for (const key of ['prompt', 'negativePrompt', 'voiceIdsInput'])
      if (!text(value[key])) throw new Error('invalid');
    if (
      typeof value.multiPromptEnabled !== 'boolean' ||
      !text(value.shotType) ||
      !['customize', 'intelligent'].includes(value.shotType) ||
      (value.cfgScale !== null && !finite(value.cfgScale))
    )
      throw new Error('invalid');
    if (
      !value.multiPromptScenes.every(
        (scene) => object(scene) && text(scene.id) && text(scene.prompt) && finite(scene.duration),
      )
    )
      throw new Error('invalid');
    const form = Object.fromEntries(
      [
        'engineId',
        'mode',
        'durationSec',
        'durationOption',
        'numFrames',
        'resolution',
        'aspectRatio',
        'fps',
        'iterations',
        'seedLocked',
        'loop',
        'audio',
        'seed',
        'cameraFixed',
        'safetyChecker',
        'extraInputValues',
      ]
        .filter((key) => f[key] !== undefined)
        .map((key) => [key, f[key]]),
    );
    const inputAssets = Object.fromEntries(
      Object.entries(value.inputAssets).map(([field, entries]) => {
        if (!field.trim() || !Array.isArray(entries)) throw new Error('invalid');
        return [field, entries.map((entry) => asset(entry, field))];
      }),
    );
    const klingElements = value.klingElements.map((element) => {
      if (
        !object(element) ||
        !text(element.id) ||
        !Array.isArray(element.references) ||
        !('frontal' in element) ||
        !('video' in element)
      )
        throw new Error('invalid');
      return {
        id: element.id,
        frontal: asset(element.frontal),
        video: asset(element.video),
        references: element.references.map((entry) => asset(entry)),
      };
    });
    const setup = {
      form,
      inputAssets,
      klingElements,
      prompt: value.prompt,
      negativePrompt: value.negativePrompt,
      multiPromptEnabled: value.multiPromptEnabled,
      multiPromptScenes: value.multiPromptScenes.map((scene) => ({
        id: scene.id,
        prompt: scene.prompt,
        duration: scene.duration,
      })),
      shotType: value.shotType,
      voiceIdsInput: value.voiceIdsInput,
      cfgScale: value.cfgScale,
    };
    const encoded = JSON.stringify(setup);
    if (bytes(encoded) > MAX_WORKSPACE_MODEL_SETUP_BYTES) return { ok: false, error: 'oversized' };
    return { ok: true, setup: JSON.parse(encoded) as WorkspaceModelSetup };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.message === 'incomplete' ? 'incomplete' : 'invalid',
    };
  }
}
export function parseWorkspaceModelSetup(value: unknown): WorkspaceModelSetup | null {
  const result = serializeWorkspaceModelSetup(value);
  return result.ok ? result.setup : null;
}
export function parseWorkspaceSavedModelSetup(
  value: unknown,
  modelId: string,
): WorkspaceSavedModelSetup | null {
  if (!object(value) || value.modelId !== modelId || !finite(value.updatedAt) || value.updatedAt <= 0)
    return null;
  const setup = parseWorkspaceModelSetup(value.setup);
  return setup && setup.form.engineId === modelId ? { modelId, updatedAt: value.updatedAt, setup } : null;
}
export function workspaceModelSetupsKey(accountId: string) {
  return `maxvideoai:model-setups:v1:${encodeURIComponent(accountId)}`;
}
export function encodeWorkspaceModelSetups(
  accountId: string,
  entries: WorkspaceModelSetupEntries,
): { ok: true; value: string } | { ok: false; error: WorkspaceModelSetupError } {
  try {
    const value = JSON.stringify({ version: 1, accountId, entries });
    return bytes(value) <= MAX_WORKSPACE_MODEL_SETUP_BYTES
      ? { ok: true, value }
      : { ok: false, error: 'oversized' };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}
export function decodeWorkspaceModelSetups(
  value: string | null,
  accountId: string,
): { entries: WorkspaceModelSetupEntries; error?: WorkspaceModelSetupError } {
  if (value === null) return { entries: {} };
  if (bytes(value) > MAX_WORKSPACE_MODEL_SETUP_BYTES) return { entries: {}, error: 'oversized' };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!object(parsed) || parsed.version !== 1 || parsed.accountId !== accountId || !object(parsed.entries))
      return { entries: {}, error: 'invalid' };
    return { entries: parsed.entries };
  } catch {
    return { entries: {}, error: 'invalid' };
  }
}
/** Equality signature only; never use this private value in logs, URLs or quote requests. */
export function workspaceModelSetupSignature(setup: WorkspaceModelSetup | null): string {
  return JSON.stringify(setup);
}
