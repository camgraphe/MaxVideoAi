'use client';

import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Camera, Film, History, Volume2 } from 'lucide-react';
import { AssetDropzone } from '@/components/AssetDropzone';
import type { AssetFieldConfig, AssetUploadMeta } from '@/components/Composer';
import { Button } from '@/components/ui/Button';
import type { EngineCaps, EngineInputField, EngineModeUiCaps, Mode } from '@/types/engines';
import {
  getGeminiOmniAssetFieldDisabledReason,
  getGeminiOmniAssetState,
  hasGeminiOmniPreviousInteraction,
} from '../../_lib/gemini-omni-unified-workflow';
import type { ReferenceAsset } from '../../_lib/workspace-assets';
import type { FormState } from '../../_lib/workspace-form-state';
import type { WorkspaceInputFieldEntry } from '../../_lib/workspace-input-schema';

export type OmniStudioPanelProps = {
  engine: EngineCaps;
  caps?: EngineModeUiCaps;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  submissionMode: Mode;
  assetFields: AssetFieldConfig[];
  extraFields: WorkspaceInputFieldEntry[];
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  onAssetAdd: (field: EngineInputField, file: File, slotIndex?: number, meta?: AssetUploadMeta) => void;
  onAssetRemove: (field: EngineInputField, index: number) => void;
  onOpenLibrary: (field: EngineInputField, slotIndex: number) => void;
  onNotice: (message: string) => void;
  disabledReason?: string | null;
};

function fieldAppliesToMode(field: EngineInputField, mode: Mode): boolean {
  return !field.modes || field.modes.includes(mode);
}

function fieldById(fields: WorkspaceInputFieldEntry[], id: string): EngineInputField | null {
  return fields.find((entry) => entry.field.id === id)?.field ?? null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function trimOrDelete(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function OmniStudioPanel({
  engine,
  caps,
  form,
  setForm,
  submissionMode,
  assetFields,
  extraFields,
  inputAssets,
  onAssetAdd,
  onAssetRemove,
  onOpenLibrary,
  onNotice,
  disabledReason = null,
}: OmniStudioPanelProps) {
  const omniAssetState = useMemo(() => getGeminiOmniAssetState(inputAssets), [inputAssets]);
  const omniWorkflowState = useMemo(
    () => ({
      ...omniAssetState,
      hasPreviousInteraction: hasGeminiOmniPreviousInteraction(form.extraInputValues.previous_interaction_id),
    }),
    [form.extraInputValues.previous_interaction_id, omniAssetState]
  );
  const visibleAssetFields = assetFields;
  const audioField = fieldById(extraFields, 'prompt_audio_direction');
  const cameraField = fieldById(extraFields, 'prompt_camera_direction');
  const editField = fieldById(extraFields, 'prompt_edit_instruction');
  const previousInteractionField = fieldById(extraFields, 'previous_interaction_id');
  const storeField = fieldById(extraFields, 'store_interaction');
  const storeInteraction = form.extraInputValues.store_interaction !== false;
  const showPreviousInteractionField =
    previousInteractionField &&
    submissionMode === 'retake' &&
    fieldAppliesToMode(previousInteractionField, submissionMode);
  const showEditField =
    editField &&
    (omniAssetState.hasSourceVideo || omniWorkflowState.hasPreviousInteraction) &&
    fieldAppliesToMode(editField, submissionMode);

  const writeExtraValue = (key: string, value: string | boolean | undefined) => {
    setForm((current) => {
      if (!current) return current;
      const next = { ...current.extraInputValues };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return { ...current, extraInputValues: next };
    });
  };

  return (
    <section className="space-y-4 rounded-[24px] border border-border/60 bg-surface-2/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
      {storeField ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant={storeInteraction ? 'primary' : 'outline'}
            onClick={() => writeExtraValue('store_interaction', !storeInteraction)}
            title={storeField.label}
            className="h-8 rounded-full px-3 text-[10px] font-semibold uppercase tracking-micro"
          >
            <History className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Store
          </Button>
        </div>
      ) : null}

      {visibleAssetFields.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleAssetFields.map((entry) => {
            const workflowDisabledReason = getGeminiOmniAssetFieldDisabledReason(entry.field.id, omniWorkflowState);
            const resolvedDisabledReason = entry.disabledReason ?? workflowDisabledReason ?? disabledReason;
            return (
              <AssetDropzone
                key={entry.field.id}
                engine={engine}
                caps={caps}
                field={entry.field}
                required={entry.required}
                role={entry.role}
                assets={inputAssets[entry.field.id] ?? []}
                density="compact"
                onSelect={onAssetAdd}
                onRemove={onAssetRemove}
                onOpenLibrary={onOpenLibrary}
                onError={onNotice}
                disabled={entry.disabled || Boolean(resolvedDisabledReason)}
                disabledReason={resolvedDisabledReason}
              />
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {showPreviousInteractionField ? (
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              {previousInteractionField.label}
            </span>
            <input
              value={stringValue(form.extraInputValues.previous_interaction_id)}
              onChange={(event) => writeExtraValue('previous_interaction_id', trimOrDelete(event.target.value))}
              className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand"
            />
          </label>
        ) : null}
        {audioField ? (
          <label className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              {audioField.label}
            </span>
            <textarea
              value={stringValue(form.extraInputValues.prompt_audio_direction)}
              onChange={(event) => writeExtraValue('prompt_audio_direction', trimOrDelete(event.target.value))}
              rows={3}
              className="min-h-[92px] rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand"
            />
          </label>
        ) : null}
        {cameraField ? (
          <label className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              {cameraField.label}
            </span>
            <textarea
              value={stringValue(form.extraInputValues.prompt_camera_direction)}
              onChange={(event) => writeExtraValue('prompt_camera_direction', trimOrDelete(event.target.value))}
              rows={3}
              className="min-h-[92px] rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand"
            />
          </label>
        ) : null}
        {showEditField ? (
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              <Film className="h-3.5 w-3.5" aria-hidden="true" />
              {editField.label}
            </span>
            <textarea
              value={stringValue(form.extraInputValues.prompt_edit_instruction)}
              onChange={(event) => writeExtraValue('prompt_edit_instruction', trimOrDelete(event.target.value))}
              rows={3}
              className="min-h-[92px] rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand"
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}
