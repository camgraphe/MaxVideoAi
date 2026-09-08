'use client';

import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { FieldLabel } from './NodeInspectorControls';
import { NodeInspectorConnections } from './NodeInspectorConnections';
import { ShotNodeToolSections } from './ShotNodeToolSections';
import { WorkspaceEnginePicker } from './WorkspaceEnginePicker';
import { WorkspaceControlField } from './nodes/WorkspaceControlField';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import { localizeWorkspaceShotOutputName } from '../_lib/workspace-generated-copy';
import { connectedInputKinds } from '../_lib/workspace-graph-helpers';
import {
  localizeStudioEdgeKindLabel,
  type StudioControlCopy,
  type StudioCopy,
} from '../../_lib/studio-copy';
import {
  compatibleCapabilitiesForShot,
  genericWorkspaceShotControlFields,
  isToolOnlyPreset,
  toolPanelSectionsForShot,
} from '../_lib/workspace-shot-inspector-helpers';
import { resolveWorkspaceBlockPolicy } from '../_lib/models/workspace-block-capability-policy';
import { buildWorkspaceEnginePickerGroups } from '../_lib/models/workspace-engine-picker';
import { workspaceShotPatchForModelSelection } from '../_lib/models/workspace-model-selection';
import { workspaceGenerationActionReady } from '../_lib/workspace-canvas-actions';

const styles = { ...baseStyles, ...inspectorStyles };

type ShotNodeInspectorProps = {
  copy: StudioCopy['canvas']['nodes'];
  controlCopy: StudioControlCopy;
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
  capabilities: WorkspaceModelCapability[];
  onPatchShot: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
  onGenerateShot: (nodeId: string) => void;
};

function workflowLabel(workflow: WorkspaceShotSettings['workflowType']): string {
  return workflow.replaceAll('_', ' ');
}

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function ShotNodeInspector({
  copy,
  controlCopy,
  node,
  edges,
  capabilities,
  onPatchShot,
  onGenerateShot,
}: ShotNodeInspectorProps) {
  const shot = node.data.shot as WorkspaceShotSettings | undefined;
  if (!shot) return null;

  const validation = node.data.validation;
  const selectedCapability = validation?.capability ?? capabilities.find((capability) => capability.id === shot.modelId) ?? null;
  const connectedInputs = connectedInputKinds(node.id, edges);
  const compatibleCapabilities = compatibleCapabilitiesForShot(
    shot,
    capabilities,
    connectedInputs
  );
  const pickerGroups = buildWorkspaceEnginePickerGroups({
    settings: shot,
    capabilities,
    connectedInputs,
    selectedModelId: shot.modelId,
    incompatibleReason: copy.enginePickerCurrentInputsIncompatible,
    pausedReason: copy.enginePickerPaused,
    waitlistReason: copy.enginePickerWaitlist,
  });
  const policy = resolveWorkspaceBlockPolicy({
    settings: shot,
    capability: selectedCapability,
    connectedInputs,
    policyCopy: controlCopy.policy,
    edgeLabel: (kind) => localizeStudioEdgeKindLabel(kind, copy),
  });
  const inspectorSections = toolPanelSectionsForShot(shot);
  const hideModelSelect = !policy.controlFields.includes('model') || !inspectorSections.includes('model-select') || (isToolOnlyPreset(shot) && compatibleCapabilities.length <= 1);
  const inputConnectors = Array.isArray(node.data.inputConnectors) ? node.data.inputConnectors : selectedCapability?.input_connectors ?? [];
  const availableInputConnectors = inputConnectors.filter((connector) => !connector.disabledReason);
  const incompatibleInputConnectors = inputConnectors.filter((connector) => Boolean(connector.disabledReason));
  const pricingEstimate = node.data.mockGeneration ? copy.simulation : node.data.pricingEstimate?.label ?? copy.estimating;
  const edgeLabel = (kind: string) => localizeStudioEdgeKindLabel(kind, copy);
  const outputName = localizeWorkspaceShotOutputName(node, copy);
  const patchShot = (patch: Partial<WorkspaceShotSettings>) => onPatchShot(node.id, patch);

  return (
    <>
      <FieldLabel>
        {copy.outputName}
        <input className={styles.settingsInput} value={outputName} onChange={(event) => patchShot({ outputName: event.currentTarget.value })} />
      </FieldLabel>

      {hideModelSelect ? (
        <div className={styles.infoGrid}>
          <span>{copy.model}</span>
          <strong>{selectedCapability?.label ?? shot.modelId}</strong>
        </div>
      ) : (
        <FieldLabel>
          {copy.model}
          <WorkspaceEnginePicker
            copy={copy}
            groups={pickerGroups}
            selectedModelId={shot.modelId}
            variant="inspector"
            onSelect={(item) => patchShot(workspaceShotPatchForModelSelection(shot, item.capability))}
          />
        </FieldLabel>
      )}

      <div className={styles.settingsGrid}>
        {genericWorkspaceShotControlFields(
          policy.controlFields,
          shot.toolKind !== 'character-builder' && shot.toolKind !== 'angle'
        ).map((field) => (
          <WorkspaceControlField
            key={field}
            copy={controlCopy}
            field={field}
            shot={shot}
            capability={selectedCapability}
            variant="inspector"
            onPatchShot={patchShot}
          />
        ))}
      </div>

      <ShotNodeToolSections
        copy={controlCopy}
        shot={shot}
        sections={inspectorSections}
        controlFields={policy.controlFields}
        onPatchShot={patchShot}
      />

      <div className={styles.validationBox}>
        {validation?.canGenerate ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        <div>
          <p>{validation?.canGenerate ? copy.readyToGenerate : copy.needsAttention}</p>
          {validation?.missingInputs.length ? <span>{formatCopyValue(copy.missingInputs, { inputs: validation.missingInputs.map(edgeLabel).join(', ') })}</span> : null}
          {validation?.incompatibleInputs.length ? <span>{formatCopyValue(copy.unsupportedInputs, { inputs: validation.incompatibleInputs.map(edgeLabel).join(', ') })}</span> : null}
          {!validation?.missingInputs.length && !validation?.incompatibleInputs.length ? <span>{copy.connectedInputsMatch}</span> : null}
        </div>
      </div>

      <div className={styles.pricingActionSummary}>
        <span>{copy.estimate}</span>
        <strong>{pricingEstimate}</strong>
      </div>

      <button type="button" className={styles.primaryPanelButton} disabled={!workspaceGenerationActionReady(Boolean(validation?.canGenerate), shot.status, node.data.pricingEstimate, node.data.mockGeneration)} onClick={() => onGenerateShot(node.id)}>
        <Sparkles size={15} />
        {shot.status === 'generating' ? copy.generating : copy.generate}
      </button>

      <div className={styles.infoGrid}>
        <span>{copy.routing}</span>
        <strong>{workflowLabel(validation?.resolvedWorkflowType ?? shot.workflowType)}</strong>
        <span>{copy.inputs}</span>
        <strong>{availableInputConnectors.length}</strong>
      </div>

      <div className={styles.connectedList}>
        <div className={styles.sectionHeading}>
          <span>{copy.availableInputs}</span>
          <span>{availableInputConnectors.length}</span>
        </div>
        {availableInputConnectors.map((connector) => (
          <div
            key={`${connector.kind}:${connector.fieldId ?? 'semantic'}`}
            className={styles.connectedRow}
            data-inspector-connector-kind={connector.kind}
            data-inspector-connector-state="available"
          >
            <span style={{ background: connector.required ? '#f97316' : '#64748b' }} />
            <p>{connector.label}</p>
            <small>{connector.capacityLabel ?? (connector.required ? copy.required : copy.optional)}</small>
          </div>
        ))}
      </div>

      {incompatibleInputConnectors.length ? (
        <div className={styles.connectedList}>
          <div className={styles.sectionHeading}>
            <span>{copy.needsAttention}</span>
            <span>{incompatibleInputConnectors.length}</span>
          </div>
          {incompatibleInputConnectors.map((connector) => (
            <div
              key={`${connector.kind}:${connector.fieldId ?? 'compatibility'}`}
              className={styles.connectedRow}
              data-inspector-connector-kind={connector.kind}
              data-inspector-connector-state="incompatible"
            >
              <span style={{ background: '#dc2626' }} />
              <p>{connector.label}</p>
              <small>{connector.disabledReason}</small>
            </div>
          ))}
        </div>
      ) : null}

      <NodeInspectorConnections copy={copy} node={node} edges={edges} />
    </>
  );
}
