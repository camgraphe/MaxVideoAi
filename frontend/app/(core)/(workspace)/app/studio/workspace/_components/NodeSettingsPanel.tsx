'use client';

import { Plus, Send, Sparkles } from 'lucide-react';
import { FieldLabel, SelectControl } from './NodeInspectorControls';
import { NodeInspectorConnections } from './NodeInspectorConnections';
import { NodeInspectorMediaPreview } from './NodeInspectorMediaPreview';
import { ShotNodeInspector } from './ShotNodeInspector';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import {
  isPlayableAudioUrl,
  isPlayableImageUrl,
  isPlayableVideoUrl,
  outputStatus,
} from '../_lib/workspace-media-availability';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceOutputMetadata,
  WorkspacePromptRole,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import { edgeLabel } from '../_lib/workspace-templates';
import type { StudioCopy } from '../../_lib/studio-copy';

const styles = { ...baseStyles, ...inspectorStyles };

type NodeSettingsPanelProps = {
  copy: StudioCopy['canvas']['nodes'];
  selectedNode: WorkspaceGraphNode | null;
  edges: WorkspaceGraphEdge[];
  capabilities: WorkspaceModelCapability[];
  onPatchNodeData: (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => void;
  onPatchShot: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
  onGenerateShot: (nodeId: string) => void;
  onSendOutputToTimeline: (nodeId: string) => void;
  onOpenAssetLibrary: (nodeId: string) => void;
};

function EmptyInspector({ copy }: { copy: StudioCopy['canvas']['nodes'] }) {
  return (
    <aside className={styles.settingsPanel} aria-label={copy.nodeSettingsAria}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelTitle}>{copy.inspectorTitle}</p>
          <span className={styles.panelSubtitle}>{copy.selectNodeToEditSettings}</span>
        </div>
      </div>
      <div className={styles.emptyInspector}>
        <Sparkles size={22} />
        <p>{copy.canvasFirst}</p>
        <span>{copy.emptyInspectorBody}</span>
      </div>
    </aside>
  );
}

function promptRoleLabel(role: WorkspacePromptRole, copy: StudioCopy['canvas']['nodes']): string {
  if (role === 'scene_description') return copy.promptRoleSceneDescription;
  return edgeLabel(role);
}

function AssetInspector({
  copy,
  node,
  edges,
  onSendOutputToTimeline,
  onOpenAssetLibrary,
}: {
  copy: StudioCopy['canvas']['nodes'];
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
  onSendOutputToTimeline: NodeSettingsPanelProps['onSendOutputToTimeline'];
  onOpenAssetLibrary: NodeSettingsPanelProps['onOpenAssetLibrary'];
}) {
  const asset = node.data.asset;
  const inputCount = Array.isArray(node.data.targetHandles) ? node.data.targetHandles.length : 0;
  const outputCount = Array.isArray(node.data.sourceHandles) ? node.data.sourceHandles.length : 0;
  const assetUrl = asset?.url ?? asset?.thumbUrl ?? null;
  const canSendAssetToTimeline = Boolean(
    asset &&
      (
        (asset.kind === 'video' && isPlayableVideoUrl(asset.url)) ||
        (asset.kind === 'audio' && isPlayableAudioUrl(asset.url)) ||
        ((asset.kind === 'image' || asset.kind === 'logo') && isPlayableImageUrl(assetUrl))
      )
  );
  return (
    <>
      <NodeInspectorMediaPreview kind={asset?.kind} thumbUrl={asset?.thumbUrl ?? null} url={asset?.url ?? null} />
      {!asset?.thumbUrl && !asset?.url ? (
        <button type="button" className={styles.primaryPanelButton} onClick={() => onOpenAssetLibrary(node.id)}>
          <Plus size={15} />
          {copy.selectMedia}
        </button>
      ) : (
        <button type="button" className={styles.secondaryPanelButton} onClick={() => onOpenAssetLibrary(node.id)}>
          <Plus size={15} />
          {copy.replaceMedia}
        </button>
      )}
      <div className={styles.timelineInsertActions}>
        <button type="button" className={styles.primaryPanelButton} disabled={!canSendAssetToTimeline} onClick={() => onSendOutputToTimeline(node.id)}>
          <Send size={15} />
          {copy.insertAtPlayhead}
        </button>
      </div>
      <div className={styles.infoGrid}>
        <span>{copy.filename}</span>
        <strong>{asset?.filename ?? node.data.subtitle ?? node.data.title}</strong>
        <span>{copy.type}</span>
        <strong>{asset?.kind ?? node.data.kind}</strong>
        <span>{copy.inputs}</span>
        <strong>{inputCount}</strong>
        <span>{copy.outputs}</span>
        <strong>{outputCount}</strong>
      </div>
      <NodeInspectorConnections copy={copy} node={node} edges={edges} />
    </>
  );
}

function PromptInspector({
  copy,
  node,
  edges,
  onPatchNodeData,
}: {
  copy: StudioCopy['canvas']['nodes'];
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
  onPatchNodeData: NodeSettingsPanelProps['onPatchNodeData'];
}) {
  const inputCount = Array.isArray(node.data.targetHandles) ? node.data.targetHandles.length : 0;
  const outputCount = Array.isArray(node.data.sourceHandles) ? node.data.sourceHandles.length : 0;
  return (
    <>
      <div className={styles.infoGrid}>
        <span>{copy.type}</span>
        <strong>{node.data.kind}</strong>
        <span>{copy.inputs}</span>
        <strong>{inputCount}</strong>
        <span>{copy.outputs}</span>
        <strong>{outputCount}</strong>
      </div>
      <FieldLabel>
        {copy.promptRole}
        <SelectControl
          value={String(node.data.promptRole ?? 'prompt')}
          onChange={(value) => onPatchNodeData(node.id, { promptRole: value as WorkspacePromptRole })}
        >
          {['prompt', 'style', 'camera', 'dialogue', 'narration', 'negative_prompt', 'scene_description'].map((role) => (
            <option key={role} value={role}>
              {promptRoleLabel(role as WorkspacePromptRole, copy)}
            </option>
          ))}
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        {copy.text}
        <textarea
          className={styles.settingsTextarea}
          value={String(node.data.promptText ?? '')}
          rows={8}
          onChange={(event) => onPatchNodeData(node.id, { promptText: event.currentTarget.value })}
        />
      </FieldLabel>
      <NodeInspectorConnections copy={copy} node={node} edges={edges} />
    </>
  );
}

function NoteInspector({
  copy,
  node,
  onPatchNodeData,
}: {
  copy: StudioCopy['canvas']['nodes'];
  node: WorkspaceGraphNode;
  onPatchNodeData: NodeSettingsPanelProps['onPatchNodeData'];
}) {
  return (
    <>
      <div className={styles.infoGrid}>
        <span>{copy.type}</span>
        <strong>{node.data.kind}</strong>
        <span>{copy.inputs}</span>
        <strong>0</strong>
        <span>{copy.outputs}</span>
        <strong>0</strong>
      </div>
      <FieldLabel>
        {copy.freeText}
        <textarea
          className={styles.settingsTextarea}
          value={String(node.data.promptText ?? '')}
          rows={10}
          onChange={(event) => onPatchNodeData(node.id, { promptText: event.currentTarget.value })}
        />
      </FieldLabel>
    </>
  );
}

function OutputInspector({
  copy,
  node,
  edges,
  onSendOutputToTimeline,
}: {
  copy: StudioCopy['canvas']['nodes'];
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
      <NodeInspectorMediaPreview kind={output?.kind} thumbUrl={output?.thumbUrl ?? null} url={output?.url ?? null} />
      <div className={styles.infoGrid}>
        <span>{copy.model}</span>
        <strong>{output?.modelLabel ?? copy.unknown}</strong>
        <span>{copy.status}</span>
        <strong>{status}</strong>
        <span>{copy.workflow}</span>
        <strong>{output?.workflowType?.replaceAll('_', ' ') ?? copy.generatedResult}</strong>
        <span>{copy.duration}</span>
        <strong>{output?.durationSec ? `${output.durationSec}s` : copy.notAvailable}</strong>
        <span>{copy.job}</span>
        <strong>{output?.jobId ?? copy.localJob}</strong>
        <span>{copy.inputs}</span>
        <strong>{inputCount}</strong>
        <span>{copy.outputs}</span>
        <strong>{outputCount}</strong>
      </div>
      <div className={styles.timelineInsertActions}>
        <button type="button" className={styles.primaryPanelButton} disabled={!canSendOutputToTimeline} onClick={() => onSendOutputToTimeline(node.id)}>
          <Send size={15} />
          {copy.insertAtPlayhead}
        </button>
      </div>
      <NodeInspectorConnections copy={copy} node={node} edges={edges} />
    </>
  );
}

export function NodeSettingsPanel({
  copy,
  selectedNode,
  edges,
  capabilities,
  onPatchNodeData,
  onPatchShot,
  onGenerateShot,
  onSendOutputToTimeline,
  onOpenAssetLibrary,
}: NodeSettingsPanelProps) {
  if (!selectedNode) return <EmptyInspector copy={copy} />;

  return (
    <aside className={styles.settingsPanel} aria-label={copy.nodeSettingsAria}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelTitle}>{selectedNode.data.title}</p>
          <span className={styles.panelSubtitle}>{selectedNode.data.subtitle ?? selectedNode.data.kind}</span>
        </div>
      </div>

      <div className={styles.settingsBody}>
        {selectedNode.data.kind === 'asset-image' || selectedNode.data.kind === 'asset-video' || selectedNode.data.kind === 'asset-audio' ? (
          <AssetInspector copy={copy} node={selectedNode} edges={edges} onSendOutputToTimeline={onSendOutputToTimeline} onOpenAssetLibrary={onOpenAssetLibrary} />
        ) : null}
        {selectedNode.data.kind === 'text-prompt' ? <PromptInspector copy={copy} node={selectedNode} edges={edges} onPatchNodeData={onPatchNodeData} /> : null}
        {selectedNode.data.kind === 'note' ? <NoteInspector copy={copy} node={selectedNode} onPatchNodeData={onPatchNodeData} /> : null}
        {selectedNode.data.kind === 'shot' ? (
          <ShotNodeInspector copy={copy} node={selectedNode} edges={edges} capabilities={capabilities} onPatchShot={onPatchShot} onGenerateShot={onGenerateShot} />
        ) : null}
        {selectedNode.data.kind === 'output' ? <OutputInspector copy={copy} node={selectedNode} edges={edges} onSendOutputToTimeline={onSendOutputToTimeline} /> : null}
      </div>
    </aside>
  );
}
