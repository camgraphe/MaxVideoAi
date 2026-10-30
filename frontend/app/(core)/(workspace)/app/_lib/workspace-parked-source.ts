import { MAX_WORKSPACE_MODEL_SETUP_BYTES, serializeWorkspaceModelSetup, serializeWorkspaceReferenceAsset } from './workspace-model-setups';
import type { WorkspaceInputAssetState } from '../_hooks/useWorkspaceAssetState';
import type { FormState } from './workspace-form-state';
import type { Mode } from '@/types/engines';

export type ParkedSourceMode = Extract<Mode, 'v2v' | 'extend' | 'reframe' | 'retake'> | 'create';
export type ParkedSourceSnapshot = { assets: WorkspaceInputAssetState; form?: FormState };
export type ParkedSources = Map<ParkedSourceMode, ParkedSourceSnapshot>;
const modes = new Set<ParkedSourceMode>(['v2v', 'extend', 'reframe', 'retake', 'create']);
const key = (scope: string, engineId: string) => `maxvideoai:parked-video-sources:v1:${encodeURIComponent(scope)}:${encodeURIComponent(engineId)}`;
const size = (value: string) => new TextEncoder().encode(value).length;

function parse(value: unknown, engineId: string): ParkedSources | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: ParkedSources = new Map();
  for (const [mode, valueSnapshot] of Object.entries(value)) {
    if (!modes.has(mode as ParkedSourceMode) || !valueSnapshot || typeof valueSnapshot !== 'object' || Array.isArray(valueSnapshot)) return null;
    // Accept the initial source-only record as well as snapshots with mode settings.
    const snapshot = valueSnapshot as Partial<ParkedSourceSnapshot>;
    const fields = snapshot.assets ?? valueSnapshot;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
    const parsed: WorkspaceInputAssetState = {};
    for (const [field, entries] of Object.entries(fields)) {
      if (!field.trim() || ['__proto__', 'constructor', 'prototype'].includes(field) || !Array.isArray(entries)) return null;
      const assets = [];
      for (const entry of entries) {
        const serialized = serializeWorkspaceReferenceAsset(entry, field);
        if (!serialized.ok) return null;
        assets.push(serialized.asset as WorkspaceInputAssetState[string][number]);
      }
      parsed[field] = assets;
    }
    let form: FormState | undefined;
    if (snapshot.form !== undefined) {
      const serialized = serializeWorkspaceModelSetup({
        form: snapshot.form, inputAssets: {}, klingElements: [], multiPromptScenes: [],
        prompt: '', negativePrompt: '', voiceIdsInput: '', multiPromptEnabled: false, shotType: 'customize', cfgScale: null,
      });
      if (!serialized.ok || serialized.setup.form.engineId !== engineId || (mode !== 'create' && serialized.setup.form.mode !== mode)) return null;
      form = serialized.setup.form;
    }
    result.set(mode as ParkedSourceMode, { assets: parsed, ...(form ? { form } : {}) });
  }
  return result;
}

export function readParkedSources(scope: string, engineId: string): ParkedSources | null {
  try {
    const raw = window.sessionStorage.getItem(key(scope, engineId));
    if (raw === null) return new Map();
    if (size(raw) > MAX_WORKSPACE_MODEL_SETUP_BYTES) return null;
    return parse(JSON.parse(raw), engineId);
  } catch { return null; }
}

export function writeParkedSources(scope: string, engineId: string, sources: ParkedSources): ParkedSources | null {
  try {
    const parsed = parse(Object.fromEntries(sources), engineId);
    if (!parsed) return null;
    if (!parsed.size) { window.sessionStorage.removeItem(key(scope, engineId)); return parsed; }
    const raw = JSON.stringify(Object.fromEntries(parsed));
    if (size(raw) > MAX_WORKSPACE_MODEL_SETUP_BYTES) return null;
    window.sessionStorage.setItem(key(scope, engineId), raw);
    return parsed;
  } catch { return null; }
}
