import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import { getVideoWorkflowSourceField, isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import { fieldAcceptsMode, getWorkspaceMediaFields } from '../_lib/workspace-multimodal-workflow';
import { revokeAssetPreview } from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import type { WorkspaceInputAssetState } from './useWorkspaceAssetState';
import { readParkedSources, writeParkedSources, type ParkedSourceMode, type ParkedSources } from '../_lib/workspace-parked-source';

export type SourceModeWarning = 'uploading' | 'storage';
type PreparedMode = { assets: WorkspaceInputAssetState; form?: FormState };

/** Sources and settings are private to their account, model and explicit workflow. */
export function useWorkspaceSourceModeAssets({ engine, mode, scope, assets, form, setAssets, onWarning }: {
  engine: EngineCaps | null; mode: Mode | undefined; scope: string; form: FormState | null;
  assets: WorkspaceInputAssetState; setAssets?: Dispatch<SetStateAction<WorkspaceInputAssetState>>;
  onWarning: (reason: SourceModeWarning) => void;
}) {
  const engineId = engine?.id;
  const record = useMemo(() => ({ parked: engineId ? readParkedSources(scope, engineId) : new Map() as ParkedSources }), [scope, engineId]);
  const active = useRef(assets);
  active.current = assets;
  useEffect(() => () => {
    const activeUrls = new Set(Object.values(active.current).flat().map(asset => asset?.previewUrl));
    for (const snapshot of record.parked?.values() ?? []) for (const asset of Object.values(snapshot.assets).flat()) {
      if (asset && !activeUrls.has(asset.previewUrl)) revokeAssetPreview(asset);
    }
  }, [record]);

  return useCallback((target: Mode | null, nextEngine?: EngineCaps, applyAssets = true): PreparedMode | null => {
    if (!engine || !setAssets) return { assets };
    const currentMode: ParkedSourceMode = isVideoSourceWorkflow(mode) || mode === 'retake' ? mode : 'create';
    const nextMode: ParkedSourceMode = target && (isVideoSourceWorkflow(target) || target === 'retake') ? target : 'create';
    const targetEngine = nextEngine ?? engine;
    const changingEngine = targetEngine.id !== engine.id;
    // Upload callbacks settle only reservations still present in active assets.
    // Excerpt preparation also owns live state that cannot be serialized midway.
    if (Object.values(assets).flat().some(asset => asset?.status === 'uploading' || asset?.excerptEditing)) {
      onWarning('uploading');
      return null;
    }
    if (currentMode === nextMode && !changingEngine) return { assets };
    const parked = record.parked ?? readParkedSources(scope, engine.id);
    const targetParked = changingEngine ? readParkedSources(scope, targetEngine.id) : parked;
    if (!parked || !targetParked) { onWarning('storage'); return null; }
    const fields = getWorkspaceMediaFields(targetEngine);
    const currentFields = getWorkspaceMediaFields(engine);
    const next = new Map(parked);
    const initialSnapshot = targetParked.get(nextMode);
    const remaining: WorkspaceInputAssetState = { ...assets };
    const currentSourceId = currentMode !== 'create' ? getVideoWorkflowSourceField(engine.inputSchema, currentMode)?.id : undefined;
    const targetSourceId = nextMode !== 'create' ? getVideoWorkflowSourceField(targetEngine.inputSchema, nextMode)?.id : undefined;
    const createModes: Mode[] = ['t2v', 'i2v', 'ref2v', 'a2v', 'r2v', ...(initialSnapshot?.form?.operation === 'kling-reference' ? ['v2v' as const] : [])];
    const acceptsTarget = (id: string) => fields.some(field => field.id === id && (nextMode === 'create'
      ? createModes.some(candidate => targetEngine.modes.includes(candidate) && fieldAcceptsMode(field, candidate))
      : fieldAcceptsMode(field, nextMode)));
    for (const id of Object.keys(assets)) {
      // A Create video reference may share its field with Modify's source. Park
      // that reference independently, as well as fields the next pruner removes.
      if (id === currentSourceId || id === targetSourceId || !acceptsTarget(id)) {
        delete remaining[id];
      }
    }
    // Shared references keep their latest active edit, including an explicit
    // removal. Source slots are always private to each workflow.
    const sourceIds = new Set((['v2v', 'extend', 'reframe', 'retake'] as const).map(value => getVideoWorkflowSourceField(engine.inputSchema, value)?.id));
    for (const [savedMode, saved] of next) {
      const updated = { ...saved.assets };
      for (const id of Object.keys(updated)) {
        const shared = !sourceIds.has(id) && currentFields.some(field => field.id === id && (currentMode === 'create'
          ? (['t2v', 'i2v', 'ref2v', 'a2v', 'r2v'] as Mode[]).some(value => engine.modes.includes(value) && fieldAcceptsMode(field, value))
          : fieldAcceptsMode(field, currentMode)));
        if (shared) {
          if (id in assets) updated[id] = assets[id];
          else delete updated[id];
        }
      }
      next.set(savedMode, { ...saved, assets: updated });
    }
    const snapshot = changingEngine ? initialSnapshot : next.get(nextMode);
    if (form) next.set(currentMode, { assets: Object.fromEntries(Object.entries(assets).map(([id, entries]) => [id, entries.map(asset => asset?.status === 'ready' ? { ...asset, excerptEditing: false } : null)])), form });
    for (const [id, entries] of Object.entries(snapshot?.assets ?? {})) {
      if (!(id in remaining) && acceptsTarget(id)) remaining[id] = entries;
    }
    // On a model change, retain the target Create settings as its last-known
    // state. Its next departure overwrites them before any model can switch.
    if (!changingEngine) next.delete(nextMode);
    // Commit before any React setter. A failed write must not make an older
    // durable source eligible for restoration or strand the current source.
    const committed = writeParkedSources(scope, engine.id, next);
    if (!committed) { onWarning('storage'); return null; }
    const retained = new Set([...Object.values(remaining).flat(), ...[...committed.values()].flatMap(value => Object.values(value.assets).flat())].map(asset => asset?.previewUrl));
    if (applyAssets) for (const value of [...Object.values(assets), ...[...parked.values()].flatMap(value => Object.values(value.assets))]) for (const asset of value) {
      if (asset && !retained.has(asset.previewUrl)) revokeAssetPreview(asset);
    }
    record.parked = committed;
    if (applyAssets) setAssets(remaining);
    return { assets: remaining, ...(snapshot?.form ? { form: snapshot.form } : {}) };
  }, [engine, mode, assets, form, setAssets, scope, record, onWarning]);
}
