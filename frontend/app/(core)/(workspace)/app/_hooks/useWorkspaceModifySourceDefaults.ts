import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import { getVideoWorkflowSourceField } from '@/lib/video-source-workflow';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import { getModifySourceDefaults } from '../_lib/workspace-modify-source-defaults';

export function useWorkspaceModifySourceDefaults({ engine, mode, inputAssets, mutationRevision, ready, scope, form, setForm }: {
  engine: EngineCaps | null; mode: Mode; inputAssets: Record<string, (ReferenceAsset | null)[]>;
  mutationRevision: number; ready: boolean; scope: string; form: FormState | null; setForm: Dispatch<SetStateAction<FormState | null>>;
}) {
  const observed = useRef<{ scope: string; context: string; source: string | null; revision: number; pendingId?: string; pendingForm?: FormState | null } | null>(null);
  useEffect(() => {
    if (!ready || !engine) return;
    const context = `${engine.id}:${mode}:${engine.activeVideoOperation ?? ''}`;
    const field = mode === 'v2v' ? getVideoWorkflowSourceField(engine.inputSchema, mode) : null;
    const sources = field ? (inputAssets[field.id] ?? []).filter((asset): asset is ReferenceAsset => asset?.kind === 'video') : [];
    const source = sources.length === 1 ? sources[0] : undefined;
    // Signed read URLs and temporary editor state must never reset explicit choices.
    const identity = source ? JSON.stringify([source.assetId ?? source.url ?? source.id, source.durationSec]) : null;
    const previous = observed.current;
    const settlingUpload = previous?.context === context && previous.pendingId === source?.id && source?.status === 'ready';
    if (!previous || previous.scope !== scope || (previous.revision === mutationRevision && !settlingUpload)) {
      observed.current = { scope, context, revision: mutationRevision, source: source?.status === 'ready' ? identity : null,
        ...(previous && previous.pendingId === source?.id && source?.status === 'uploading' ? { pendingId: previous.pendingId, pendingForm: previous.pendingForm } : {}) };
      return; // A hydrated draft/reused generation retains its saved settings.
    }
    if (!source || mode !== 'v2v') {
      observed.current = { scope, context, revision: mutationRevision, source: null };
      return;
    }
    if (source.status !== 'ready' || source.excerptEditing) {
      observed.current = { scope, context, revision: mutationRevision, source: previous.source,
        ...(source.status === 'uploading' ? { pendingId: source.id, pendingForm: previous.pendingId === source.id && previous.context === context ? previous.pendingForm : form } : {}) };
      return;
    }
    if (previous.context === context && previous.source === identity) {
      observed.current = { ...previous, revision: mutationRevision };
      return;
    }
    observed.current = { scope, context, revision: mutationRevision, source: identity };
    const patch = getModifySourceDefaults(engine, mode, source);
    if (!Object.keys(patch).length) return;
    setForm(current => {
      if (!current || current.engineId !== engine.id || current.mode !== mode) return current;
      const applicable = { ...patch };
      if (settlingUpload && previous.pendingForm) {
        if (current.durationSec !== previous.pendingForm.durationSec || current.durationOption !== previous.pendingForm.durationOption) {
          delete applicable.durationSec; delete applicable.durationOption; delete applicable.numFrames;
        }
        if (current.aspectRatio !== previous.pendingForm.aspectRatio) delete applicable.aspectRatio;
      }
      return { ...current, ...applicable };
    });
  }, [engine, mode, inputAssets, mutationRevision, ready, scope, form, setForm]);
}
