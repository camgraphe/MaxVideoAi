'use client';

import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Camera, Film, History, Images, RotateCcw, Volume2, WandSparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AssetDropzone } from '@/components/AssetDropzone';
import type { AssetFieldConfig, AssetUploadMeta } from '@/components/Composer';
import { Button } from '@/components/ui/Button';
import type { EngineCaps, EngineInputField, EngineModeUiCaps, Mode } from '@/types/engines';
import type { ReferenceAsset } from '../../_lib/workspace-assets';
import type { FormState } from '../../_lib/workspace-form-state';
import type { WorkspaceInputFieldEntry } from '../../_lib/workspace-input-schema';

export const OMNI_CUSTOM_FIELD_IDS = new Set([
  'store_interaction',
  'previous_interaction_id',
  'prompt_audio_direction',
  'prompt_camera_direction',
  'prompt_edit_instruction',
]);

type OmniModeOption = {
  mode: Mode;
  label: string;
  icon: LucideIcon;
};

type OmniStudioPanelProps = {
  engine: EngineCaps;
  caps?: EngineModeUiCaps;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  activeMode: Mode;
  submissionMode: Mode;
  assetFields: AssetFieldConfig[];
  extraFields: WorkspaceInputFieldEntry[];
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  onAssetAdd: (field: EngineInputField, file: File, slotIndex?: number, meta?: AssetUploadMeta) => void;
  onAssetRemove: (field: EngineInputField, index: number) => void;
  onOpenLibrary: (field: EngineInputField, slotIndex: number) => void;
  onNotice: (message: string) => void;
  onModeToggle: (mode: Mode | null) => void;
  disabledReason?: string | null;
};

const OMNI_MODE_OPTIONS: OmniModeOption[] = [
  { mode: 't2v', label: 'Text', icon: WandSparkles },
  { mode: 'i2v', label: 'Image', icon: Images },
  { mode: 'ref2v', label: 'Refs', icon: Camera },
  { mode: 'v2v', label: 'Video', icon: Film },
  { mode: 'retake', label: 'Refine', icon: RotateCcw },
];

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
  activeMode,
  submissionMode,
  assetFields,
  extraFields,
  inputAssets,
  onAssetAdd,
  onAssetRemove,
  onOpenLibrary,
  onNotice,
  onModeToggle,
  disabledReason = null,
}: OmniStudioPanelProps) {
  const visibleModes = useMemo(
    () => OMNI_MODE_OPTIONS.filter((option) => engine.modes.includes(option.mode)),
    [engine.modes]
  );
  const visibleAssetFields = useMemo(
    () => assetFields.filter((entry) => fieldAppliesToMode(entry.field, submissionMode)),
    [assetFields, submissionMode]
  );
  const audioField = fieldById(extraFields, 'prompt_audio_direction');
  const cameraField = fieldById(extraFields, 'prompt_camera_direction');
  const editField = fieldById(extraFields, 'prompt_edit_instruction');
  const previousInteractionField = fieldById(extraFields, 'previous_interaction_id');
  const storeField = fieldById(extraFields, 'store_interaction');
  const storeInteraction = form.extraInputValues.store_interaction !== false;

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

  const handleModeClick = (mode: Mode) => {
    onModeToggle(mode === 't2v' ? null : mode);
  };

  return (
    <section className="space-y-4 rounded-[24px] border border-border/60 bg-surface-2/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {visibleModes.map((option) => {
            const Icon = option.icon;
            const selected = activeMode === option.mode || submissionMode === option.mode;
            return (
              <Button
                key={option.mode}
                type="button"
                variant={selected ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleModeClick(option.mode)}
                title={option.label}
                className="h-10 rounded-2xl px-4 text-[12px] font-semibold"
              >
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {option.label}
              </Button>
            );
          })}
        </div>
        {storeField ? (
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
        ) : null}
      </div>

      {visibleAssetFields.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleAssetFields.map((entry) => (
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
              disabled={entry.disabled || Boolean(disabledReason)}
              disabledReason={entry.disabledReason ?? disabledReason}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {previousInteractionField && fieldAppliesToMode(previousInteractionField, submissionMode) ? (
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
        {editField && fieldAppliesToMode(editField, submissionMode) ? (
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
