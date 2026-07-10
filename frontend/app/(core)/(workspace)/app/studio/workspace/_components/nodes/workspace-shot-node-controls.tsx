'use client';

import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import nodeStyles from '../../_styles/canvas-nodes.module.css';
import shotStyles from '../../_styles/canvas-shot-controls.module.css';
import type {
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from '../../_lib/workspace-types';
import {
  compatibleCapabilitiesForShot,
  isToolOnlyPreset,
  toolPanelSectionsForShot,
} from '../../_lib/workspace-shot-inspector-helpers';
import { resolveWorkspaceBlockPolicy } from '../../_lib/models/workspace-block-capability-policy';
import { WorkspaceControlField } from './WorkspaceControlField';
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

export function ShotNodeControls({ data, nodeId }: ShotNodeControlsProps) {
  const shot = data.shot;
  if (!shot) return null;

  const copy = data.studioCanvasCopy?.nodes ?? DEFAULT_STUDIO_COPY.canvas.nodes;
  const modelCapabilities = Array.isArray(data.modelCapabilities) ? data.modelCapabilities as WorkspaceModelCapability[] : [];
  const validation = data.validation;
  const selectedCapability = validation?.capability ?? modelCapabilities.find((capability) => capability.id === shot.modelId) ?? null;
  const connectedInputs = Array.isArray(data.inputConnectors)
    ? data.inputConnectors.filter((connector) => (connector.connectedCount ?? 0) > 0).map((connector) => connector.kind)
    : [];
  const compatibleCapabilities = modelCapabilities.length
    ? compatibleCapabilitiesForShot(shot, modelCapabilities, connectedInputs)
    : selectedCapability ? [selectedCapability] : [];
  const sections = toolPanelSectionsForShot(shot);
  const policy = resolveWorkspaceBlockPolicy({
    settings: shot,
    capability: selectedCapability,
    connectedInputs,
  });
  const hideModelSelect = !policy.controlFields.includes('model') || !sections.includes('model-select') || (isToolOnlyPreset(shot) && compatibleCapabilities.length <= 1);
  const canGenerate = validation?.canGenerate ?? policy.canGenerate;
  const estimatedCost = data.pricingEstimate?.label ?? copy.estimating;
  const pricingDetail = data.pricingEstimate?.error ?? estimatedCost;
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
  const statusDetail = data.pricingEstimate?.error
    ? `${validationText}. ${data.pricingEstimate.error}`
    : validationText;

  return (
    <div className={styles.shotControlPanel} data-shot-node-grammar="primary-settings generate-status">
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
        {policy.controlFields.filter((field) => field !== 'model').map((field) => (
          <WorkspaceControlField
            key={field}
            field={field}
            shot={shot}
            capability={selectedCapability}
            onPatchShot={patchShot}
          />
        ))}
      </div>

      <div className={styles.shotActionRow}>
        <button
          type="button"
          className={`${styles.shotGenerateButton} nodrag`}
          disabled={!canGenerate || shot.status === 'generating'}
          aria-busy={shot.status === 'generating'}
          onClick={() => data.onGenerateShot?.(nodeId)}
        >
          <span className={styles.shotGenerateLabel} data-shot-generate-label="true">
            <Sparkles size={12} />
            <span>{shot.status === 'generating' ? copy.generating : copy.generate}</span>
          </span>
          <strong
            className={styles.shotGeneratePrice}
            data-shot-generate-price="true"
            title={pricingDetail}
            aria-label={pricingDetail}
          >
            {estimatedCost}
          </strong>
        </button>
      </div>

      <div className={`${styles.shotValidationLine} ${canGenerate ? styles.shotValidationReady : styles.shotValidationWarning}`}>
        {canGenerate ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
        <span>{canGenerate ? copy.readyToGenerate : copy.needsAttention}</span>
        <small title={statusDetail}>{statusDetail}</small>
      </div>
    </div>
  );
}
