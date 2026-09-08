'use client';

import { useEffect, useRef, useState } from 'react';
import type { Connection } from '@xyflow/react';
import { X, Link2, Unplug } from 'lucide-react';
import { workspaceConnectionCandidates } from '../../_lib/workspace-canvas-actions';
import type { WorkspaceEdgeKind, WorkspaceGraphEdge, WorkspaceGraphNode } from '../../_lib/workspace-types';
import { localizeStudioEdgeKindLabel, type StudioCopy } from '../../../_lib/studio-copy';
import styles from '../../_styles/canvas-actions.module.css';

export function CanvasConnectionPicker({ node, initialHandle, nodes, edges, copy, onConnect, onDisconnect, isValidConnection, onClose }: {
  node: WorkspaceGraphNode;
  initialHandle?: WorkspaceEdgeKind;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  copy: StudioCopy['canvas']['nodes'];
  onConnect: (connection: Connection) => void;
  onDisconnect: (id: string) => void;
  isValidConnection: (connection: Connection) => boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState(initialHandle ?? node.data.targetHandles?.[0]);
  const incoming = edges.filter((edge) => edge.target === node.id || edge.source === node.id);
  const connector = node.data.inputConnectors?.find((item) => item.kind === handle);
  const candidates = handle ? workspaceConnectionCandidates(nodes, node.id, handle, isValidConnection) : [];
  const restorePanelFocus = () => requestAnimationFrame(() => panelRef.current?.focus());
  useEffect(() => {
    const launcher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => { if (launcher?.isConnected) launcher.focus(); };
  }, []);
  return <div className={styles.connectionBackdrop} onClick={onClose}>
    <div ref={panelRef} tabIndex={-1} className={styles.connectionPicker} role="dialog" aria-modal="true" aria-labelledby="canvas-connections-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select') ?? []);
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header><div><small>{node.data.title}</small><h2 id="canvas-connections-title">{copy.connections}</h2></div><button type="button" aria-label={copy.closeConnections} onClick={onClose}><X size={18} /></button></header>
      <div className={styles.connectionContent}>
        {node.data.targetHandles?.length ? <label>{copy.inputs}<select value={handle} onChange={(event) => setHandle(event.target.value as WorkspaceEdgeKind)}>{node.data.targetHandles.map((kind) => <option key={kind} value={kind}>{localizeStudioEdgeKindLabel(kind, copy)}</option>)}</select></label> : null}
        {connector?.disabledReason ? <p role="status">{connector.disabledReason}</p> : null}
        {handle ? <section aria-label={copy.connectSource}>
          <h3>{copy.connectSource}</h3>
          {candidates.length ? candidates.map(({ connection, title, kind }) => <button type="button" key={`${connection.source}:${connection.sourceHandle}`} onClick={() => { onConnect(connection); restorePanelFocus(); }}><Link2 size={16} /><span>{title}<small>{kind.startsWith('asset-') ? kind.slice(6) : localizeStudioEdgeKindLabel(connection.sourceHandle, copy)}</small></span></button>) : <p role="status">{copy.noCompatibleSources}</p>}
        </section> : null}
        <section aria-label={copy.connectedInputs}><h3>{copy.connections}</h3>{incoming.length ? incoming.map((edge) => <div className={styles.connectionRow} key={edge.id}><span>{nodes.find((candidate) => candidate.id === (edge.source === node.id ? edge.target : edge.source))?.data.title ?? copy.assetFallback}<small>{localizeStudioEdgeKindLabel(edge.data?.kind ?? 'reference', copy)}</small></span><button type="button" onClick={() => { onDisconnect(edge.id); restorePanelFocus(); }}><Unplug size={16} />{copy.disconnect}</button></div>) : <p>{copy.noGraphConnections}</p>}</section>
      </div>
    </div>
  </div>;
}
