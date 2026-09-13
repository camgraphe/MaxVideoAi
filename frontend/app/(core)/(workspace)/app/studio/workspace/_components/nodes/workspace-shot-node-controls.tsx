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
import { buildWorkspaceEnginePickerGroups } from '../../_lib/models/workspace-engine-picker';
import { workspaceShotPatchForModelSelection } from '../../_lib/models/workspace-model-selection';
import { workspaceGenerationActionReady } from '../../_lib/workspace-canvas-actions';
import { WorkspaceEnginePicker } from '../WorkspaceEnginePicker';
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

export function ShotNodeControls({ data, nodeId }: ShotNodeControlsProps) {
  const shot = data.shot;
  if (!shot) return null;

  const canvasCopy = data.studioCanvasCopy ?? DEFAULT_STUDIO_COPY.canvas;
  const copy = canvasCopy.nodes;
  const controlCopy = canvasCopy.controls;
  const modelCapabilities = Array.isArray(data.modelCapabilities) ? data.modelCapabilities as WorkspaceModelCapability[] : [];
  const validation = data.validation;
  const selectedCapability = validation?.capability ?? modelCapabilities.find((capability) => capability.id === shot.modelId) ?? null;
  const connectedInputs = Array.isArray(data.inputConnectors)
    ? data.inputConnectors.filter((connector) => (connector.connectedCount ?? 0) > 0).map((connector) => connector.kind)
    : [];
  const compatibleCapabilities = modelCapabilities.length
    ? compatibleCapabilitiesForShot(shot, modelCapabilities, connectedInputs)
    : selectedCapability ? [selectedCapability] : [];
  const pickerGroups = buildWorkspaceEnginePickerGroups({
    settings: shot,
    capabilities: modelCapabilities,
    connectedInputs,
    selectedModelId: shot.modelId,
    incompatibleReason: copy.enginePickerCurrentInputsIncompatible,
    pausedReason: copy.enginePickerPaused,
    waitlistReason: copy.enginePickerWaitlist,
  });
  const sections = toolPanelSectionsForShot(shot);
  const policy = resolveWorkspaceBlockPolicy({
    settings: shot,
    capability: selectedCapability,
    connectedInputs,
    policyCopy: controlCopy.policy,
    edgeLabel: (kind) => localizeStudioEdgeKindLabel(kind, copy),
  });
  const hideModelSelect = !policy.controlFields.includes('model') || !sections.includes('model-select') || (isToolOnlyPreset(shot) && compatibleCapabilities.length <= 1);
  const commonFields = policy.controlFields.filter((field) => ['durationSec', 'aspectRatio', 'resolution', 'audioEnabled'].includes(field));
  const canGenerate = validation?.canGenerate ?? policy.canGenerate;
  const estimatedCost = data.mockGeneration ? copy.simulation : data.pricingEstimate?.label ?? copy.estimating;
  const pricingDetail = data.mockGeneration ? estimatedCost : data.pricingEstimate?.error ?? estimatedCost;
  const patchShot = (patch: Partial<WorkspaceShotSettings>) => data.onPatchShot?.(nodeId, patch);
  const edgeLabel = (kind: string) => localizeStudioEdgeKindLabel(kind, copy);
  const missingInputs = validation?.missingInputs ?? [];
  const incompatibleInputs = validation?.incompatibleInputs ?? [];
  const validationText = missingInputs.length
    ? formatCopyValue(copy.missingInputs, { inputs: missingInputs.map(edgeLabel).join(', ') })
    : incompatibleInputs.length
      ? formatCopyValue(copy.unsupportedInputs, { inputs: incompatibleInputs.map(edgeLabel).join(', ') })
      : copy.connectedInputsMatch;
  const statusDetail = !data.mockGeneration && data.pricingEstimate?.error
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
        <label className={`${styles.shotControlField} ${styles.shotModelField} nodrag nowheel`}>
          <span>{copy.model}</span>
          <WorkspaceEnginePicker
            copy={copy}
            groups={pickerGroups}
            selectedModelId={shot.modelId}
            variant="node"
            onSelect={(item) => patchShot(workspaceShotPatchForModelSelection(shot, item.capability))}
          />
        </label>
      )}

      <div className={styles.shotSettingsGrid}>
        {commonFields.map((field) => (
          <WorkspaceControlField
            key={field}
            copy={controlCopy}
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
          data-shot-generation-action="true"
          disabled={!workspaceGenerationActionReady(canGenerate, shot.status, data.pricingEstimate, data.mockGeneration)}
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

      <div
        className={`${styles.shotValidationLine} ${canGenerate ? styles.shotValidationReady : styles.shotValidationWarning}`}
        data-shot-generation-status="true"
      >
        {canGenerate ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
        <span>{canGenerate ? copy.readyToGenerate : copy.needsAttention}</span>
        {!canGenerate || data.pricingEstimate?.error ? <small title={statusDetail}>{statusDetail}</small> : null}
      </div>
    </div>
  );
}
