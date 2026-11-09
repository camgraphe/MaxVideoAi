import { invalidateLibraryMedia } from '@/hooks/useLibraryCacheRevision';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { useRef } from 'react';
import { saveAssetToLibrary, saveImageToLibrary } from '@/lib/api';
import { getSeedanceFieldBlockKey, isUnifiedSeedanceEngineId } from '@/lib/seedance-workflow';
import { getMediaInputEligibility } from '@/lib/media-input-eligibility';
import { mediaInputEligibilityMessage } from '@/components/library/media-input-eligibility-copy';
import type { EngineCaps, EngineInputField, EngineInputSchema, Mode } from '@/types/engines';
import {
  revokeAssetPreview,
  buildReferenceAssetFromLibraryAsset,
  getLibraryAssetFieldMismatchMessage,
  mergeMirroredLibraryAsset,
  shouldMirrorCharacterImageAsset,
  shouldMirrorVideoLibraryAsset,
  tryInsertReferenceAsset,
  type UserAsset,
} from '../_lib/workspace-assets';
import type { CommitInputAssetMutation, WorkspaceInputAssetState } from './useWorkspaceAssetState';

type Options = {
  accountId?: string | null;
  intent: string;
  opening?: object | null;
  valid: () => boolean;
  engineId?: string | null;
  engine?: EngineCaps | null;
  locale: string;
  mode: Mode;
  inputSchema?: EngineInputSchema | null;
  inputAssets: WorkspaceInputAssetState;
  currentField?: EngineInputField;
  commit: CommitInputAssetMutation;
  close: () => void;
  workflowCopy: { clearReferencesToUseStartEnd: string; clearStartEndToUseReferences: string };
};

/** Prepare durable mirrors first; the domain's current-state transaction is the sole draft commit. */
export function useWorkspaceReferenceBatch(options: Options) {
  const intent = useRef({ key: options.intent, opening: options.opening, prepared: new Map<string, UserAsset>(), saved: new Set<string>() });
  if (intent.current.key !== options.intent || intent.current.opening !== options.opening)
    intent.current = { key: options.intent, opening: options.opening, prepared: new Map(), saved: new Set() };
  const captured = intent.current;
  const latest = useRef(options);
  latest.current = options;
  return async (
    field: EngineInputField,
    assets: UserAsset[],
    acceptance?: { isCurrent: () => boolean },
    slotIndex?: number,
  ): Promise<true | string> => {
    const current = () => options.valid() && captured === intent.current && (acceptance?.isCurrent() ?? true);
    const retired = 'This selection is no longer active.';
    if (!current()) return retired;
    const candidate = (previous: WorkspaceInputAssetState, sources: UserAsset[]) => {
      const live = latest.current;
      const currentField =
        [...(live.inputSchema?.required ?? []), ...(live.inputSchema?.optional ?? [])].find(
          (item) => item.id === field.id,
        ) ?? (live.currentField?.id === field.id ? live.currentField : field);
      if (
        slotIndex !== undefined &&
        (sources.length !== 1 ||
          !Number.isInteger(slotIndex) ||
          slotIndex < 0 ||
          (currentField.maxCount && slotIndex >= currentField.maxCount))
      )
        return { state: previous, error: 'This reference slot is no longer available.' };
      if (!sources.length) return { state: previous, error: 'Choose a reference.' };
      let next = previous;
      for (const asset of sources) {
        const blocked = isUnifiedSeedanceEngineId(live.engineId)
          ? getSeedanceFieldBlockKey(field.id, next, (next[field.id] ?? []).some(Boolean))
          : null;
        if (blocked)
          return {
            state: previous,
            error:
              blocked === 'clearReferences'
                ? live.workflowCopy.clearReferencesToUseStartEnd
                : live.workflowCopy.clearStartEndToUseReferences,
          };
        const mismatch = getLibraryAssetFieldMismatchMessage(currentField, asset);
        if (mismatch) return { state: previous, error: mismatch };
        const eligibility = getMediaInputEligibility({
          asset,
          field: currentField,
          engine: live.engine,
          mode: live.mode,
        });
        if (eligibility.status === 'blocked')
          return { state: previous, error: mediaInputEligibilityMessage(eligibility, live.locale)! };
        // The existing budget uses exact original URL identity; duplicates do not consume another slot.
        if (slotIndex === undefined && (next[field.id] ?? []).some((item) => item?.url === asset.url)) continue;
        const insertion = tryInsertReferenceAsset(
          next,
          currentField,
          buildReferenceAssetFromLibraryAsset(currentField, asset),
          slotIndex,
          { inputSchema: live.inputSchema, preferredMode: live.mode },
        );
        if (!insertion.accepted)
          return {
            state: previous,
            error:
              insertion.reason === 'reference_budget'
                ? `Maximum ${insertion.maxTotal} total references reached for this engine mode.`
                : `Maximum ${field.label ?? 'reference'} count reached for this engine.`,
          };
        next = insertion.state;
      }
      return { state: next, error: null };
    };
    const preflight = candidate(latest.current.inputAssets, assets);
    if (preflight.error) return preflight.error;
    const prepared: UserAsset[] = [];
    const request = {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => ownedAuthFetch(input, options.accountId ?? null, init),
    };
    try {
      for (const asset of assets) {
        if (!current()) return retired;
        const key = JSON.stringify([asset.ref, asset.assetId, asset.id, asset.url, asset.sourceOutputId]);
        let result = captured.prepared.get(key);
        if (!result) {
          const video = field.type === 'video' && shouldMirrorVideoLibraryAsset(asset);
          const image = field.type === 'image' && shouldMirrorCharacterImageAsset(asset);
          if (video || image) {
            const saved = video
              ? await saveAssetToLibrary(
                  {
                    url: asset.url,
                    label: asset.name ?? field.label ?? 'Video',
                    source: asset.source === 'recent' ? 'saved_job_output' : asset.source,
                    kind: 'video',
                    jobId: asset.jobId ?? null,
                    sourceOutputId: asset.sourceOutputId ?? null,
                    durationSec: asset.durationSec ?? null,
                  },
                  request,
                )
              : await saveImageToLibrary(
                  { url: asset.url, label: asset.name ?? field.label ?? 'Image', source: asset.source },
                  request,
                );
            if (!saved?.url)
              throw new Error(
                'Unable to prepare this reference. Completed library saves remain available; retry the selection.',
              );
            result = mergeMirroredLibraryAsset(asset, saved);
            captured.saved.add(key);
            if (options.accountId) invalidateLibraryMedia(options.accountId);
          } else result = asset;
          captured.prepared.set(key, result);
        }
        prepared.push(result);
      }
    } catch {
      return current()
        ? options.locale.startsWith('fr')
          ? `Préparation impossible. ${captured.saved.size} média(s) enregistré(s) ; réessayez la sélection.`
          : options.locale.startsWith('es')
            ? `No se pudo preparar. ${captured.saved.size} archivo(s) guardado(s); reintenta la selección.`
            : `Unable to prepare these references. ${captured.saved.size} media saved; retry the selection.`
        : retired;
    }
    if (!current()) return retired;
    let replaced: import('../_lib/workspace-assets').ReferenceAsset | null = null;
    const result = latest.current.commit((previous) => {
      const result = candidate(previous, prepared);
      if (!result.error && slotIndex !== undefined) replaced = previous[field.id]?.[slotIndex] ?? null;
      return result;
    });
    if (result.error) return result.error;
    if (replaced) revokeAssetPreview(replaced);
    latest.current.close();
    return true;
  };
}
