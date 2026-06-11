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

const styles = { ...baseStyles, ...inspectorStyles };

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

function AssetInspector({
  node,
  edges,
  onSendOutputToTimeline,
  onOpenAssetLibrary,
}: {
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
          Select media
        </button>
      ) : (
        <button type="button" className={styles.secondaryPanelButton} onClick={() => onOpenAssetLibrary(node.id)}>
          <Plus size={15} />
          Replace media
        </button>
      )}
      <div className={styles.timelineInsertActions}>
        <button type="button" className={styles.primaryPanelButton} disabled={!canSendAssetToTimeline} onClick={() => onSendOutputToTimeline(node.id)}>
          <Send size={15} />
          Insert at playhead
        </button>
      </div>
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
      <NodeInspectorConnections node={node} edges={edges} />
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
      <NodeInspectorConnections node={node} edges={edges} />
    </>
  );
}

function NoteInspector({
  node,
  onPatchNodeData,
}: {
  node: WorkspaceGraphNode;
  onPatchNodeData: NodeSettingsPanelProps['onPatchNodeData'];
}) {
  return (
    <>
      <div className={styles.infoGrid}>
        <span>Type</span>
        <strong>{node.data.kind}</strong>
        <span>Inputs</span>
        <strong>0</strong>
        <span>Outputs</span>
        <strong>0</strong>
      </div>
      <FieldLabel>
        Free text
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
      <NodeInspectorMediaPreview kind={output?.kind} thumbUrl={output?.thumbUrl ?? null} url={output?.url ?? null} />
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
      <div className={styles.timelineInsertActions}>
        <button type="button" className={styles.primaryPanelButton} disabled={!canSendOutputToTimeline} onClick={() => onSendOutputToTimeline(node.id)}>
          <Send size={15} />
          Insert at playhead
        </button>
      </div>
      <NodeInspectorConnections node={node} edges={edges} />
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
          <AssetInspector node={selectedNode} edges={edges} onSendOutputToTimeline={onSendOutputToTimeline} onOpenAssetLibrary={onOpenAssetLibrary} />
        ) : null}
        {selectedNode.data.kind === 'text-prompt' ? <PromptInspector node={selectedNode} edges={edges} onPatchNodeData={onPatchNodeData} /> : null}
        {selectedNode.data.kind === 'note' ? <NoteInspector node={selectedNode} onPatchNodeData={onPatchNodeData} /> : null}
        {selectedNode.data.kind === 'shot' ? (
          <ShotNodeInspector node={selectedNode} edges={edges} capabilities={capabilities} onPatchShot={onPatchShot} onGenerateShot={onGenerateShot} />
        ) : null}
        {selectedNode.data.kind === 'output' ? <OutputInspector node={selectedNode} edges={edges} onSendOutputToTimeline={onSendOutputToTimeline} /> : null}
      </div>
    </aside>
  );
}
