'use client';

import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import nodeStyles from '../../_styles/canvas-nodes.module.css';
import shotStyles from '../../_styles/canvas-shot-controls.module.css';
import type {
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceRenderOption,
  WorkspaceShotSettings,
} from '../../_lib/workspace-types';
import {
  compatibleCapabilitiesForShot,
  isToolOnlyPreset,
  toolPanelSectionsForShot,
} from '../../_lib/workspace-shot-inspector-helpers';
import {
  DEFAULT_STUDIO_COPY,
  localizeStudioEdgeKindLabel,
} from '../../../_lib/studio-copy';

const styles = { ...nodeStyles, ...shotStyles };

type ShotNodeControlsProps = {
  data: WorkspaceGraphNode['data'];
  nodeId: string;
};

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function patchForModelSelection(
  shot: WorkspaceShotSettings,
  nextCapability: WorkspaceModelCapability | null,
  modelId: string
): Partial<WorkspaceShotSettings> {
  const audioOption = nextCapability?.render_options.find((option) => option.id === 'audio') ?? null;
  const lipSyncOption = nextCapability?.render_options.find((option) => option.id === 'lip_sync') ?? null;
  return {
    modelId,
    family: nextCapability?.family ?? shot.family,
    outputKind: nextCapability?.outputKind === 'text' ? shot.outputKind : nextCapability?.outputKind ?? shot.outputKind,
    audioEnabled: audioOption?.control === 'toggle' ? audioOption.defaultEnabled : false,
    lipSyncEnabled: lipSyncOption?.control === 'toggle' ? lipSyncOption.defaultEnabled : false,
  };
}

function renderOptionToggle({
  copy,
  enabled,
  option,
  onToggle,
}: {
  copy: typeof DEFAULT_STUDIO_COPY.canvas.nodes;
  enabled: boolean;
  option: WorkspaceRenderOption;
  onToggle: () => void;
}) {
  if (option.control === 'included') {
    return (
      <div key={option.id} className={styles.shotToggleRow}>
        <span>{option.label}</span>
        <strong>{copy.included}</strong>
      </div>
    );
  }
  return (
    <div key={option.id} className={styles.shotToggleRow}>
      <span>{option.label}</span>
      <button type="button" className={`${styles.shotToggleButton} ${enabled ? styles.shotToggleButtonActive : ''} nodrag`} onClick={onToggle}>
        {enabled ? copy.on : copy.off}
      </button>
    </div>
  );
}

export function ShotNodeControls({ data, nodeId }: ShotNodeControlsProps) {
  const shot = data.shot;
  if (!shot) return null;

  const copy = data.studioCanvasCopy?.nodes ?? DEFAULT_STUDIO_COPY.canvas.nodes;
  const modelCapabilities = Array.isArray(data.modelCapabilities) ? data.modelCapabilities as WorkspaceModelCapability[] : [];
  const validation = data.validation;
  const selectedCapability = validation?.capability ?? modelCapabilities.find((capability) => capability.id === shot.modelId) ?? null;
  const compatibleCapabilities = modelCapabilities.length ? compatibleCapabilitiesForShot(shot, modelCapabilities) : selectedCapability ? [selectedCapability] : [];
  const sections = toolPanelSectionsForShot(shot);
  const hideModelSelect = !sections.includes('model-select') || (isToolOnlyPreset(shot) && compatibleCapabilities.length <= 1);
  const renderOptions = selectedCapability?.render_options ?? [];
  const audioRenderOption = renderOptions.find((option) => option.id === 'audio') ?? null;
  const lipSyncRenderOption = renderOptions.find((option) => option.id === 'lip_sync') ?? null;
  const durations = selectedCapability?.supported_durations.length ? selectedCapability.supported_durations : [5, 7, 8, 10];
  const ratios = selectedCapability?.supported_aspect_ratios.length ? selectedCapability.supported_aspect_ratios : ['16:9', '9:16', '1:1'];
  const resolutions = selectedCapability?.supported_resolutions.length ? selectedCapability.supported_resolutions : ['720p', '1080p'];
  const fpsValues = selectedCapability?.supported_fps.length ? selectedCapability.supported_fps : [24, 30];
  const canGenerate = validation?.canGenerate ?? shot.status !== 'incompatible';
  const estimatedCost = data.pricingEstimate?.label ?? copy.estimating;
  const patchShot = (patch: Partial<WorkspaceShotSettings>) => data.onPatchShot?.(nodeId, patch);
  const recommendedModels = (validation?.recommendedModels ?? [])
    .filter((capability) => compatibleCapabilities.some((candidate) => candidate.id === capability.id))
    .slice(0, 3);
  const recommendedModelIds = new Set(recommendedModels.map((capability) => capability.id));
  const remainingModels = compatibleCapabilities.filter((capability) => !recommendedModelIds.has(capability.id));
  const edgeLabel = (kind: string) => localizeStudioEdgeKindLabel(kind, copy);
  const missingInputs = validation?.missingInputs ?? [];
  const incompatibleInputs = validation?.incompatibleInputs ?? [];
  const validationText = missingInputs.length
    ? formatCopyValue(copy.missingInputs, { inputs: missingInputs.map(edgeLabel).join(', ') })
    : incompatibleInputs.length
      ? formatCopyValue(copy.unsupportedInputs, { inputs: incompatibleInputs.map(edgeLabel).join(', ') })
      : copy.connectedInputsMatch;

  return (
    <div className={styles.shotControlPanel}>
      {hideModelSelect ? (
        <div className={styles.shotModelSummary}>
          <span>{copy.model}</span>
          <strong>{selectedCapability?.label ?? shot.modelId}</strong>
        </div>
      ) : (
        <label className={`${styles.shotControlField} ${styles.shotModelField}`}>
          <span>{copy.model}</span>
          <select
            className={`${styles.shotSelect} nodrag nowheel`}
            value={shot.modelId}
            onChange={(event) => {
              const modelId = event.currentTarget.value;
              const nextCapability = modelCapabilities.find((capability) => capability.id === modelId) ?? null;
              patchShot(patchForModelSelection(shot, nextCapability, modelId));
            }}
          >
            {recommendedModels.length ? (
              <optgroup label={copy.recommended}>
                {recommendedModels.map((capability) => <option key={`recommended-${capability.id}`} value={capability.id}>{capability.label}</option>)}
              </optgroup>
            ) : null}
            <optgroup label={copy.allModels}>
              {remainingModels.map((capability) => <option key={capability.id} value={capability.id}>{capability.label}</option>)}
            </optgroup>
          </select>
        </label>
      )}

      <div className={styles.shotSettingsGrid}>
        {shot.outputKind === 'video' || shot.family === 'audio' ? (
          <label className={styles.shotControlField}>
            <span>{copy.duration}</span>
            <select className={`${styles.shotSelect} nodrag nowheel`} value={shot.durationSec} onChange={(event) => patchShot({ durationSec: Number(event.currentTarget.value) })}>
              {durations.map((duration) => <option key={duration} value={duration}>{duration}s</option>)}
            </select>
          </label>
        ) : null}
        {shot.outputKind === 'video' || shot.outputKind === 'image' ? (
          <label className={styles.shotControlField}>
            <span>{copy.aspect}</span>
            <select className={`${styles.shotSelect} nodrag nowheel`} value={shot.aspectRatio} onChange={(event) => patchShot({ aspectRatio: event.currentTarget.value as WorkspaceShotSettings['aspectRatio'] })}>
              {ratios.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
            </select>
          </label>
        ) : null}
        {shot.outputKind === 'video' || shot.outputKind === 'image' || shot.family === 'upscale' ? (
          <label className={styles.shotControlField}>
            <span>{copy.resolution}</span>
            <select className={`${styles.shotSelect} nodrag nowheel`} value={shot.resolution} onChange={(event) => patchShot({ resolution: event.currentTarget.value as WorkspaceShotSettings['resolution'] })}>
              {resolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}
            </select>
          </label>
        ) : null}
        {shot.outputKind === 'video' ? (
          <label className={styles.shotControlField}>
            <span>{copy.fps}</span>
            <select className={`${styles.shotSelect} nodrag nowheel`} value={shot.fps} onChange={(event) => patchShot({ fps: Number(event.currentTarget.value) })}>
              {fpsValues.map((fps) => <option key={fps} value={fps}>{fps}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {shot.family !== 'audio' && !shot.toolKind ? (
        <label className={`${styles.shotControlField} ${styles.shotReferenceControl}`}>
          <span>{copy.referenceStrength}</span>
          <input
            className={`${styles.shotRange} nodrag nowheel`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={shot.referenceStrength}
            onChange={(event) => patchShot({ referenceStrength: Number(event.currentTarget.value) })}
          />
          <strong>{Math.round(shot.referenceStrength * 100)}%</strong>
        </label>
      ) : null}

      {audioRenderOption || lipSyncRenderOption ? (
        <div className={styles.shotToggleGrid}>
          {audioRenderOption ? renderOptionToggle({
            copy,
            enabled: shot.audioEnabled,
            option: audioRenderOption,
            onToggle: () => patchShot({ audioEnabled: !shot.audioEnabled }),
          }) : null}
          {lipSyncRenderOption ? renderOptionToggle({
            copy,
            enabled: shot.lipSyncEnabled,
            option: lipSyncRenderOption,
            onToggle: () => patchShot({ lipSyncEnabled: !shot.lipSyncEnabled }),
          }) : null}
        </div>
      ) : null}

      <div className={styles.shotActionRow}>
        <button
          type="button"
          className={`${styles.shotGenerateButton} nodrag`}
          disabled={!canGenerate || shot.status === 'generating'}
          onClick={() => data.onGenerateShot?.(nodeId)}
        >
          <span>
            <Sparkles size={12} />
            {shot.status === 'generating' ? copy.generating : copy.generate}
          </span>
          <strong>{estimatedCost}</strong>
        </button>
      </div>

      <div className={`${styles.shotValidationLine} ${canGenerate ? styles.shotValidationReady : styles.shotValidationWarning}`}>
        {canGenerate ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
        <span>{canGenerate ? copy.readyToGenerate : copy.needsAttention}</span>
        <small>{validationText}</small>
      </div>
    </div>
  );
}
