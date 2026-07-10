'use client';

import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { FieldLabel, SelectControl } from './NodeInspectorControls';
import { NodeInspectorConnections } from './NodeInspectorConnections';
import { ShotNodeToolSections } from './ShotNodeToolSections';
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
  type StudioCopy,
} from '../../_lib/studio-copy';
import {
  compatibleCapabilitiesForShot,
  genericWorkspaceShotControlFields,
  isToolOnlyPreset,
  toolPanelSectionsForShot,
} from '../_lib/workspace-shot-inspector-helpers';
import { resolveWorkspaceBlockPolicy } from '../_lib/models/workspace-block-capability-policy';

const styles = { ...baseStyles, ...inspectorStyles };

type ShotNodeInspectorProps = {
  copy: StudioCopy['canvas']['nodes'];
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
  const policy = resolveWorkspaceBlockPolicy({ settings: shot, capability: selectedCapability, connectedInputs });
  const inspectorSections = toolPanelSectionsForShot(shot);
  const hideModelSelect = !policy.controlFields.includes('model') || !inspectorSections.includes('model-select') || (isToolOnlyPreset(shot) && compatibleCapabilities.length <= 1);
  const inputConnectors = Array.isArray(node.data.inputConnectors) ? node.data.inputConnectors : selectedCapability?.input_connectors ?? [];
  const pricingEstimate = node.data.pricingEstimate?.label ?? copy.estimating;
  const recommendedModels = (validation?.recommendedModels ?? [])
    .filter((capability) => compatibleCapabilities.some((candidate) => candidate.id === capability.id))
    .slice(0, 4);
  const recommendedModelIds = new Set(recommendedModels.map((model) => model.id));
  const remainingCapabilities = compatibleCapabilities.filter((capability) => !recommendedModelIds.has(capability.id));
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
          <SelectControl
            value={shot.modelId}
            onChange={(value) => {
              const nextCapability = capabilities.find((capability) => capability.id === value) ?? null;
              const nextAudioOption = nextCapability?.render_options.find((option) => option.id === 'audio') ?? null;
              const nextLipSyncOption = nextCapability?.render_options.find((option) => option.id === 'lip_sync') ?? null;
              patchShot({
                modelId: value,
                family: nextCapability?.family ?? shot.family,
                outputKind: nextCapability?.outputKind === 'text' ? shot.outputKind : nextCapability?.outputKind ?? shot.outputKind,
                audioEnabled: nextAudioOption?.control === 'toggle' ? nextAudioOption.defaultEnabled : false,
                lipSyncEnabled: nextLipSyncOption?.control === 'toggle' ? nextLipSyncOption.defaultEnabled : false,
              });
            }}
          >
            {recommendedModels.length ? (
              <optgroup label={copy.recommended}>
                {recommendedModels.map((capability) => (
                  <option key={`recommended-${capability.id}`} value={capability.id}>
                    {capability.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={copy.allModels}>
              {remainingCapabilities.map((capability) => (
                <option key={capability.id} value={capability.id}>
                  {capability.label}
                </option>
              ))}
            </optgroup>
          </SelectControl>
        </FieldLabel>
      )}

      <div className={styles.settingsGrid}>
        {genericWorkspaceShotControlFields(policy.controlFields).map((field) => (
          <WorkspaceControlField
            key={field}
            field={field}
            shot={shot}
            capability={selectedCapability}
            variant="inspector"
            onPatchShot={patchShot}
          />
        ))}
      </div>

      <ShotNodeToolSections
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

      <button type="button" className={styles.primaryPanelButton} disabled={!validation?.canGenerate || shot.status === 'generating'} onClick={() => onGenerateShot(node.id)}>
        <Sparkles size={15} />
        {shot.status === 'generating' ? copy.generating : copy.generate}
      </button>

      <div className={styles.infoGrid}>
        <span>{copy.routing}</span>
        <strong>{workflowLabel(validation?.resolvedWorkflowType ?? shot.workflowType)}</strong>
        <span>{copy.inputs}</span>
        <strong>{inputConnectors.length}</strong>
      </div>

      <div className={styles.connectedList}>
        <div className={styles.sectionHeading}>
          <span>{copy.availableInputs}</span>
          <span>{inputConnectors.length}</span>
        </div>
        {inputConnectors.map((connector) => (
          <div key={connector.kind} className={styles.connectedRow}>
            <span style={{ background: connector.required ? '#f97316' : '#64748b' }} />
            <p>{connector.label}</p>
            <small>{connector.capacityLabel ?? (connector.required ? copy.required : copy.optional)}</small>
          </div>
        ))}
      </div>

      <NodeInspectorConnections copy={copy} node={node} edges={edges} />
    </>
  );
}
