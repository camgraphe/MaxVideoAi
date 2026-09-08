'use client';

import { useEffect, useRef } from 'react';
import type { Connection } from '@xyflow/react';
import { Link2, Plus, Unplug, X } from 'lucide-react';
import { workspaceConnectionCandidates } from '../../_lib/workspace-canvas-actions';
import {
  resolveWorkspaceHandleDropDraft,
  type WorkspaceHandleDropRequest,
} from '../../_lib/workspace-handle-drop';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceInputConnector,
} from '../../_lib/workspace-types';
import { localizeStudioEdgeKindLabel, type StudioCopy } from '../../../_lib/studio-copy';
import styles from '../../_styles/canvas-actions.module.css';

function restoreConnectionLauncherFocus(launcher: HTMLElement | null, nodeId: string): void {
  if (launcher?.isConnected) {
    launcher.focus();
    return;
  }
  const nodeElement = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node'))
    .find((candidate) => candidate.dataset.id === nodeId);
  const fallback = nodeElement?.querySelector<HTMLElement>('[data-canvas-connections-fallback]')
    ?? document.querySelector<HTMLElement>('[data-studio-canvas-shell]');
  fallback?.focus();
}

type ConnectionSlotStatus = 'available' | 'connected' | 'full' | 'disabled' | 'missing_required';

function slotStatus(connector: WorkspaceInputConnector): ConnectionSlotStatus {
  if (connector.disabledReason) return 'disabled';
  if (connector.remainingCount === 0) return 'full';
  if ((connector.connectedCount ?? 0) > 0) return 'connected';
  return connector.required ? 'missing_required' : 'available';
}

function slotStatusLabel(status: ConnectionSlotStatus, copy: StudioCopy['canvas']['nodes']): string {
  if (status === 'connected') return copy.slotConnected;
  if (status === 'full') return copy.slotFull;
  if (status === 'disabled') return copy.slotDisabled;
  if (status === 'missing_required') return copy.slotMissingRequired;
  return copy.slotAvailable;
}

function slotCapacity(connector: WorkspaceInputConnector, copy: StudioCopy['canvas']['nodes']): string | null {
  if (typeof connector.connectedCount !== 'number' || typeof connector.maxCount !== 'number') return null;
  return copy.usedCapacity
    .replace('{used}', String(connector.connectedCount))
    .replace('{maximum}', String(connector.maxCount));
}

function fallbackConnector(kind: WorkspaceEdgeKind, copy: StudioCopy['canvas']['nodes']): WorkspaceInputConnector {
  return {
    kind,
    label: localizeStudioEdgeKindLabel(kind, copy),
    required: false,
    maxCount: 1,
    sourceType: 'control',
  };
}

export type CanvasConnectionPickerProps = {
  node: WorkspaceGraphNode;
  initialHandle?: WorkspaceEdgeKind;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  copy: StudioCopy['canvas']['nodes'];
  onConnect: (connection: Connection) => void;
  onDisconnect: (id: string) => void;
  onCreateAndConnect?: (request: WorkspaceHandleDropRequest) => void;
  isValidConnection: (connection: Connection) => boolean;
  onClose: () => void;
};

export function CanvasConnectionPicker({
  node,
  initialHandle,
  nodes,
  edges,
  copy,
  onConnect,
  onDisconnect,
  onCreateAndConnect,
  isValidConnection,
  onClose,
}: CanvasConnectionPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const connectors = node.data.inputConnectors?.length
    ? node.data.inputConnectors
    : (node.data.targetHandles ?? []).map((kind) => fallbackConnector(kind, copy));
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const restorePanelFocus = () => requestAnimationFrame(() => panelRef.current?.focus());

  useEffect(() => {
    const launcher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => restoreConnectionLauncherFocus(launcher, node.id);
  }, [node.id]);

  return <div className={styles.connectionBackdrop} onClick={onClose}>
    <div
      ref={panelRef}
      tabIndex={-1}
      className={styles.connectionPicker}
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-connections-title"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (event.key === 'Tab') {
          const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header>
        <div><small>{node.data.title}</small><h2 id="canvas-connections-title">{copy.connections}</h2></div>
        <button type="button" aria-label={copy.closeConnections} onClick={onClose}><X size={18} /></button>
      </header>
      <div className={styles.connectionContent}>
        <section className={styles.connectionSlotBoard} aria-label={copy.inputs}>
          {connectors.map((connector, index) => {
            const handle = connector.kind;
            const status = slotStatus(connector);
            const capacity = slotCapacity(connector, copy);
            const connectedEdges = edges.filter((edge) => (
              edge.target === node.id
              && (edge.targetHandle === handle || edge.data?.kind === handle)
            ));
            const candidates = status === 'full' || status === 'disabled'
              ? []
              : workspaceConnectionCandidates(nodes, node.id, handle, isValidConnection);
            const draft = resolveWorkspaceHandleDropDraft(handle, 'target');
            const label = connector.label || localizeStudioEdgeKindLabel(handle, copy);
            const createPosition = { x: node.position.x - 260, y: node.position.y + index * 120 };
            return <article
              key={`${handle}:${connector.fieldId ?? ''}`}
              className={`${styles.connectionSlot} ${styles[`connectionSlot_${status}`] ?? ''}`}
              data-connection-slot={handle}
              data-connection-field-id={connector.fieldId}
              data-connection-slot-status={status}
              aria-current={initialHandle === handle ? 'true' : undefined}
            >
              <div className={styles.connectionSlotHeader}>
                <div>
                  <h3>{label}</h3>
                  <small>{connector.required ? copy.required : copy.optional}{capacity ? ` · ${capacity}` : ''}</small>
                </div>
                <span className={styles.connectionSlotStatus}>{slotStatusLabel(status, copy)}</span>
              </div>
              {connector.disabledReason ? <p role="status">{connector.disabledReason}</p> : null}
              {connectedEdges.map((edge) => <div className={styles.connectionRow} key={edge.id}>
                <span>{nodes.find((candidate) => candidate.id === edge.source)?.data.title ?? copy.assetFallback}</span>
                <button type="button" onClick={() => { onDisconnect(edge.id); restorePanelFocus(); }}>
                  <Unplug size={16} />{copy.disconnect}
                </button>
              </div>)}
              {candidates.map(({ connection, title, kind }) => <button
                type="button"
                key={`${connection.source}:${connection.sourceHandle}`}
                onClick={() => { onConnect(connection); restorePanelFocus(); }}
              >
                <Link2 size={16} />
                <span>{title}<small>{kind.startsWith('asset-') ? kind.slice(6) : localizeStudioEdgeKindLabel(connection.sourceHandle, copy)}</small></span>
              </button>)}
              {draft && onCreateAndConnect && status !== 'full' && status !== 'disabled' ? <button
                type="button"
                className={styles.connectionCreateAction}
                data-create-and-connect={handle}
                onClick={() => {
                  onCreateAndConnect({
                    sourceNodeId: node.id,
                    handleId: handle,
                    handleType: 'target',
                    position: createPosition,
                  });
                  restorePanelFocus();
                }}
              >
                <Plus size={16} />{copy.createAndConnect}
              </button> : null}
            </article>;
          })}
          {!connectors.length ? <p role="status">{copy.noCompatibleSources}</p> : null}
        </section>
        {outgoing.length ? <section aria-label={copy.connectedOutputs}>
          <h3>{copy.connectedOutputs}</h3>
          {outgoing.map((edge) => <div className={styles.connectionRow} key={edge.id}>
            <span>{nodes.find((candidate) => candidate.id === edge.target)?.data.title ?? copy.assetFallback}
              <small>{localizeStudioEdgeKindLabel(edge.data?.kind ?? 'reference', copy)}</small>
            </span>
            <button type="button" onClick={() => { onDisconnect(edge.id); restorePanelFocus(); }}>
              <Unplug size={16} />{copy.disconnect}
            </button>
          </div>)}
        </section> : null}
      </div>
    </div>
  </div>;
}
