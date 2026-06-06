'use client';

/* eslint-disable @next/next/no-img-element */

import { AlertTriangle, CheckCircle2, Plus, Send, Sparkles } from 'lucide-react';
import styles from '../maxvideoai-editor.module.css';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceOutputMetadata,
  WorkspaceOutputStatus,
  WorkspacePromptRole,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import { edgeLabel } from '../_lib/workspace-templates';

type NodeSettingsPanelProps = {
  selectedNode: WorkspaceGraphNode | null;
  edges: WorkspaceGraphEdge[];
  capabilities: WorkspaceModelCapability[];
  onPatchNodeData: (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => void;
  onPatchShot: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
  onGenerateShot: (nodeId: string) => void;
  onSendOutputToTimeline: (nodeId: string) => void;
  onOpenAssetLibrary: (nodeId: string) => void;
};

function connectedEdges(nodeId: string, edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className={styles.settingsLabel}>{children}</label>;
}

function SelectControl({
  value,
  onChange,
  children,
}: {
  value: string | number;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select className={styles.settingsInput} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      {children}
    </select>
  );
}

function NumberControl({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      className={styles.settingsInput}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
  );
}

function EmptyInspector() {
  return (
    <aside className={styles.settingsPanel} aria-label="Node settings">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelTitle}>Inspector</p>
          <span className={styles.panelSubtitle}>Select a node to edit settings</span>
        </div>
      </div>
      <div className={styles.emptyInspector}>
        <Sparkles size={22} />
        <p>Canvas first</p>
        <span>Pick a shot, prompt, asset or output to inspect its graph role.</span>
      </div>
    </aside>
  );
}

function promptRoleLabel(role: WorkspacePromptRole): string {
  if (role === 'scene_description') return 'Scene description';
  return edgeLabel(role);
}

function isPlayableVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

function outputStatus(output: WorkspaceOutputMetadata | undefined): WorkspaceOutputStatus {
  if (!output) return 'placeholder';
  if (output.status) return output.status;
  if (output.kind === 'video') return isPlayableVideoUrl(output.url) ? 'ready' : 'placeholder';
  return output.url || output.thumbUrl ? 'ready' : 'placeholder';
}

function InspectorMediaPreview({
  kind,
  thumbUrl,
  url,
}: {
  kind?: string;
  thumbUrl?: string | null;
  url?: string | null;
}) {
  const playableVideoUrl = kind === 'video' && isPlayableVideoUrl(url) ? url : null;
  const previewUrl = thumbUrl ?? url ?? null;
  if (playableVideoUrl) {
    return (
      <div className={styles.inspectorPreview}>
        <video className={`${styles.previewVideo} nodrag`} controls playsInline preload="metadata" poster={thumbUrl ?? undefined} src={playableVideoUrl} />
      </div>
    );
  }
  if (!previewUrl) return null;
  return (
    <div className={styles.inspectorPreview}>
      <img src={previewUrl} alt="" />
    </div>
  );
}

function ConnectionsList({ node, edges }: { node: WorkspaceGraphNode; edges: WorkspaceGraphEdge[] }) {
  const connections = connectedEdges(node.id, edges);
  const incomingCount = connections.filter((edge) => edge.target === node.id).length;
  const outgoingCount = connections.length - incomingCount;
  const heading = incomingCount && outgoingCount ? 'Connections' : incomingCount ? 'Connected inputs' : 'Connected outputs';
  return (
    <div className={styles.connectedList}>
      <div className={styles.sectionHeading}>
        <span>{heading}</span>
        <span>{connections.length}</span>
      </div>
      {connections.length ? (
        connections.map((edge) => (
          <div key={edge.id} className={styles.connectedRow}>
            <span style={{ background: edge.data?.color ?? '#8b5cf6' }} />
            <p>{edgeLabel(edge.data?.kind ?? 'reference')}</p>
            <small>{edge.source === node.id ? `To ${edge.target}` : `From ${edge.source}`}</small>
          </div>
        ))
      ) : (
        <p className={styles.mutedText}>No graph connections yet.</p>
      )}
    </div>
  );
}

function AssetInspector({
  node,
  edges,
  onOpenAssetLibrary,
}: {
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
  onOpenAssetLibrary: NodeSettingsPanelProps['onOpenAssetLibrary'];
}) {
  const asset = node.data.asset;
  const inputCount = Array.isArray(node.data.targetHandles) ? node.data.targetHandles.length : 0;
  const outputCount = Array.isArray(node.data.sourceHandles) ? node.data.sourceHandles.length : 0;
  return (
    <>
      <InspectorMediaPreview kind={asset?.kind} thumbUrl={asset?.thumbUrl ?? null} url={asset?.url ?? null} />
      {!asset?.thumbUrl && !asset?.url ? (
        <button type="button" className={styles.primaryPanelButton} onClick={() => onOpenAssetLibrary(node.id)}>
          <Plus size={15} />
          Select media
        </button>
      ) : (
        <button type="button" className={styles.secondaryPanelButton} onClick={() => onOpenAssetLibrary(node.id)}>
          <Plus size={15} />
          Replace media
        </button>
      )}
      <div className={styles.infoGrid}>
        <span>Filename</span>
        <strong>{asset?.filename ?? node.data.subtitle ?? node.data.title}</strong>
        <span>Type</span>
        <strong>{asset?.kind ?? node.data.kind}</strong>
        <span>Inputs</span>
        <strong>{inputCount}</strong>
        <span>Outputs</span>
        <strong>{outputCount}</strong>
      </div>
      <ConnectionsList node={node} edges={edges} />
    </>
  );
}

function PromptInspector({
  node,
  edges,
  onPatchNodeData,
}: {
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
  onPatchNodeData: NodeSettingsPanelProps['onPatchNodeData'];
}) {
  const inputCount = Array.isArray(node.data.targetHandles) ? node.data.targetHandles.length : 0;
  const outputCount = Array.isArray(node.data.sourceHandles) ? node.data.sourceHandles.length : 0;
  return (
    <>
      <div className={styles.infoGrid}>
        <span>Type</span>
        <strong>{node.data.kind}</strong>
        <span>Inputs</span>
        <strong>{inputCount}</strong>
        <span>Outputs</span>
        <strong>{outputCount}</strong>
      </div>
      <FieldLabel>
        Prompt role
        <SelectControl
          value={String(node.data.promptRole ?? 'prompt')}
          onChange={(value) => onPatchNodeData(node.id, { promptRole: value as WorkspacePromptRole })}
        >
          {['prompt', 'style', 'camera', 'dialogue', 'narration', 'negative_prompt', 'scene_description'].map((role) => (
            <option key={role} value={role}>
              {promptRoleLabel(role as WorkspacePromptRole)}
            </option>
          ))}
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        Text
        <textarea
          className={styles.settingsTextarea}
          value={String(node.data.promptText ?? '')}
          rows={8}
          onChange={(event) => onPatchNodeData(node.id, { promptText: event.currentTarget.value })}
        />
      </FieldLabel>
      <ConnectionsList node={node} edges={edges} />
    </>
  );
}

function workflowLabel(workflow: WorkspaceShotSettings['workflowType']): string {
  return workflow.replaceAll('_', ' ');
}

function ShotInspector({
  node,
  edges,
  capabilities,
  onPatchShot,
  onGenerateShot,
}: {
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
  capabilities: WorkspaceModelCapability[];
  onPatchShot: NodeSettingsPanelProps['onPatchShot'];
  onGenerateShot: NodeSettingsPanelProps['onGenerateShot'];
}) {
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

      <ConnectionsList node={node} edges={edges} />
    </>
  );
}

function OutputInspector({
  node,
  edges,
  onSendOutputToTimeline,
}: {
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
  onSendOutputToTimeline: NodeSettingsPanelProps['onSendOutputToTimeline'];
}) {
  const output = node.data.output as WorkspaceOutputMetadata | undefined;
  const status = outputStatus(output);
  const canSendOutputToTimeline = status === 'ready' && Boolean(output?.url);
  const inputCount = Array.isArray(node.data.targetHandles) ? node.data.targetHandles.length : 0;
  const outputCount = Array.isArray(node.data.sourceHandles) ? node.data.sourceHandles.length : 0;
  return (
    <>
      <InspectorMediaPreview kind={output?.kind} thumbUrl={output?.thumbUrl ?? null} url={output?.url ?? null} />
      <div className={styles.infoGrid}>
        <span>Model</span>
        <strong>{output?.modelLabel ?? 'Unknown'}</strong>
        <span>Status</span>
        <strong>{status}</strong>
        <span>Workflow</span>
        <strong>{output?.workflowType?.replaceAll('_', ' ') ?? 'Generated'}</strong>
        <span>Duration</span>
        <strong>{output?.durationSec ? `${output.durationSec}s` : 'n/a'}</strong>
        <span>Job</span>
        <strong>{output?.jobId ?? 'local'}</strong>
        <span>Inputs</span>
        <strong>{inputCount}</strong>
        <span>Outputs</span>
        <strong>{outputCount}</strong>
      </div>
      <button type="button" className={styles.primaryPanelButton} disabled={!canSendOutputToTimeline} onClick={() => onSendOutputToTimeline(node.id)}>
        <Send size={15} />
        Send to timeline
      </button>
      <ConnectionsList node={node} edges={edges} />
    </>
  );
}

export function NodeSettingsPanel({
  selectedNode,
  edges,
  capabilities,
  onPatchNodeData,
  onPatchShot,
  onGenerateShot,
  onSendOutputToTimeline,
  onOpenAssetLibrary,
}: NodeSettingsPanelProps) {
  if (!selectedNode) return <EmptyInspector />;

  return (
    <aside className={styles.settingsPanel} aria-label="Node settings">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelTitle}>{selectedNode.data.title}</p>
          <span className={styles.panelSubtitle}>{selectedNode.data.subtitle ?? selectedNode.data.kind}</span>
        </div>
      </div>

      <div className={styles.settingsBody}>
        {selectedNode.data.kind === 'asset-image' || selectedNode.data.kind === 'asset-video' || selectedNode.data.kind === 'asset-audio' ? (
          <AssetInspector node={selectedNode} edges={edges} onOpenAssetLibrary={onOpenAssetLibrary} />
        ) : null}
        {selectedNode.data.kind === 'text-prompt' ? <PromptInspector node={selectedNode} edges={edges} onPatchNodeData={onPatchNodeData} /> : null}
        {selectedNode.data.kind === 'shot' ? (
          <ShotInspector node={selectedNode} edges={edges} capabilities={capabilities} onPatchShot={onPatchShot} onGenerateShot={onGenerateShot} />
        ) : null}
        {selectedNode.data.kind === 'output' ? <OutputInspector node={selectedNode} edges={edges} onSendOutputToTimeline={onSendOutputToTimeline} /> : null}
      </div>
    </aside>
  );
}
