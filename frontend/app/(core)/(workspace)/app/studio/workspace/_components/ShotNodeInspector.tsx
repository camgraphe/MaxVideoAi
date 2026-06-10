'use client';

import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { FieldLabel, NumberControl, SelectControl } from './NodeInspectorControls';
import { NodeInspectorConnections } from './NodeInspectorConnections';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import { edgeLabel } from '../_lib/workspace-templates';

const styles = { ...baseStyles, ...inspectorStyles };

type ShotNodeInspectorProps = {
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
  capabilities: WorkspaceModelCapability[];
  onPatchShot: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
  onGenerateShot: (nodeId: string) => void;
};

function workflowLabel(workflow: WorkspaceShotSettings['workflowType']): string {
  return workflow.replaceAll('_', ' ');
}

export function ShotNodeInspector({
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
  const inputConnectors = Array.isArray(node.data.inputConnectors) ? node.data.inputConnectors : selectedCapability?.input_connectors ?? [];
  const renderOptions = selectedCapability?.render_options ?? [];
  const audioRenderOption = renderOptions.find((option) => option.id === 'audio') ?? null;
  const lipSyncRenderOption = renderOptions.find((option) => option.id === 'lip_sync') ?? null;
  const durations = selectedCapability?.supported_durations.length ? selectedCapability.supported_durations : [5, 7, 8, 10];
  const ratios = selectedCapability?.supported_aspect_ratios.length ? selectedCapability.supported_aspect_ratios : ['16:9', '9:16', '1:1'];
  const resolutions = selectedCapability?.supported_resolutions.length ? selectedCapability.supported_resolutions : ['720p', '1080p'];
  const fpsValues = selectedCapability?.supported_fps.length ? selectedCapability.supported_fps : [24, 30];
  const pricingEstimate = node.data.pricingEstimate?.label ?? 'Estimating...';
  const recommendedModels = (validation?.recommendedModels ?? []).slice(0, 4);
  const recommendedModelIds = new Set(recommendedModels.map((model) => model.id));
  const remainingCapabilities = capabilities.filter((capability) => !recommendedModelIds.has(capability.id));

  return (
    <>
      <FieldLabel>
        Output name
        <input className={styles.settingsInput} value={shot.outputName} onChange={(event) => onPatchShot(node.id, { outputName: event.currentTarget.value })} />
      </FieldLabel>
      <FieldLabel>
        Model
        <SelectControl
          value={shot.modelId}
          onChange={(value) => {
            const nextCapability = capabilities.find((capability) => capability.id === value) ?? null;
            const nextAudioOption = nextCapability?.render_options.find((option) => option.id === 'audio') ?? null;
            const nextLipSyncOption = nextCapability?.render_options.find((option) => option.id === 'lip_sync') ?? null;
            onPatchShot(node.id, {
              modelId: value,
              audioEnabled: nextAudioOption?.control === 'toggle' ? nextAudioOption.defaultEnabled : false,
              lipSyncEnabled: nextLipSyncOption?.control === 'toggle' ? nextLipSyncOption.defaultEnabled : false,
            });
          }}
        >
          {recommendedModels.length ? (
            <optgroup label="Recommended">
              {recommendedModels.map((capability) => (
                <option key={`recommended-${capability.id}`} value={capability.id}>
                  {capability.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="All models">
            {remainingCapabilities.map((capability) => (
              <option key={capability.id} value={capability.id}>
                {capability.label}
              </option>
            ))}
          </optgroup>
        </SelectControl>
      </FieldLabel>

      <div className={styles.settingsGrid}>
        <FieldLabel>
          Duration
          <SelectControl value={shot.durationSec} onChange={(value) => onPatchShot(node.id, { durationSec: Number(value) })}>
            {durations.map((duration) => (
              <option key={duration} value={duration}>
                {duration}s
              </option>
            ))}
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          Aspect
          <SelectControl value={shot.aspectRatio} onChange={(value) => onPatchShot(node.id, { aspectRatio: value as WorkspaceShotSettings['aspectRatio'] })}>
            {ratios.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          Resolution
          <SelectControl value={shot.resolution} onChange={(value) => onPatchShot(node.id, { resolution: value as WorkspaceShotSettings['resolution'] })}>
            {resolutions.map((resolution) => (
              <option key={resolution} value={resolution}>
                {resolution}
              </option>
            ))}
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          FPS
          <SelectControl value={shot.fps} onChange={(value) => onPatchShot(node.id, { fps: Number(value) })}>
            {fpsValues.map((fps) => (
              <option key={fps} value={fps}>
                {fps}
              </option>
            ))}
          </SelectControl>
        </FieldLabel>
      </div>

      <FieldLabel>
        Reference strength
        <NumberControl value={shot.referenceStrength} min={0} max={1} step={0.05} onChange={(value) => onPatchShot(node.id, { referenceStrength: value })} />
      </FieldLabel>

      {audioRenderOption?.control === 'toggle' ? (
        <div className={styles.toggleRow}>
          <span>{audioRenderOption.label}</span>
          <button type="button" className={shot.audioEnabled ? styles.toggleActive : ''} onClick={() => onPatchShot(node.id, { audioEnabled: !shot.audioEnabled })}>
            {shot.audioEnabled ? 'On' : 'Off'}
          </button>
        </div>
      ) : null}
      {audioRenderOption?.control === 'included' ? (
        <div className={styles.toggleRow}>
          <span>{audioRenderOption.label}</span>
          <strong className={styles.optionStateBadge}>Included</strong>
        </div>
      ) : null}
      {lipSyncRenderOption?.control === 'toggle' ? (
        <div className={styles.toggleRow}>
          <span>{lipSyncRenderOption.label}</span>
          <button type="button" className={shot.lipSyncEnabled ? styles.toggleActive : ''} onClick={() => onPatchShot(node.id, { lipSyncEnabled: !shot.lipSyncEnabled })}>
            {shot.lipSyncEnabled ? 'On' : 'Off'}
          </button>
        </div>
      ) : null}

      <div className={styles.validationBox}>
        {validation?.canGenerate ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        <div>
          <p>{validation?.canGenerate ? 'Ready to generate' : 'Needs attention'}</p>
          {validation?.missingInputs.length ? <span>Missing: {validation.missingInputs.map(edgeLabel).join(', ')}</span> : null}
          {validation?.incompatibleInputs.length ? <span>Unsupported: {validation.incompatibleInputs.map(edgeLabel).join(', ')}</span> : null}
          {!validation?.missingInputs.length && !validation?.incompatibleInputs.length ? <span>Connected inputs match selected model.</span> : null}
        </div>
      </div>

      <div className={styles.pricingActionSummary}>
        <span>Estimate</span>
        <strong>{pricingEstimate}</strong>
      </div>

      <button type="button" className={styles.primaryPanelButton} disabled={!validation?.canGenerate || shot.status === 'generating'} onClick={() => onGenerateShot(node.id)}>
        <Sparkles size={15} />
        {shot.status === 'generating' ? 'Generating' : 'Generate'}
      </button>

      <div className={styles.infoGrid}>
        <span>Routing</span>
        <strong>{workflowLabel(validation?.resolvedWorkflowType ?? shot.workflowType)}</strong>
        <span>Inputs</span>
        <strong>{inputConnectors.length}</strong>
      </div>

      <div className={styles.connectedList}>
        <div className={styles.sectionHeading}>
          <span>Available inputs</span>
          <span>{inputConnectors.length}</span>
        </div>
        {inputConnectors.map((connector) => (
          <div key={connector.kind} className={styles.connectedRow}>
            <span style={{ background: connector.required ? '#f97316' : '#64748b' }} />
            <p>{connector.label}</p>
            <small>{connector.capacityLabel ?? (connector.required ? 'Required' : 'Optional')}</small>
          </div>
        ))}
      </div>

      <NodeInspectorConnections node={node} edges={edges} />
    </>
  );
}
