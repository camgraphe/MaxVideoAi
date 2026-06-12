'use client';

import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
} from '../_lib/workspace-types';
import { edgeLabel } from '../_lib/workspace-templates';
import type { StudioCopy } from '../../_lib/studio-copy';

const styles = { ...baseStyles, ...inspectorStyles };

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function connectedEdges(nodeId: string, edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}

export function NodeInspectorConnections({
  copy,
  node,
  edges,
}: {
  copy: StudioCopy['canvas']['nodes'];
  node: WorkspaceGraphNode;
  edges: WorkspaceGraphEdge[];
}) {
  const connections = connectedEdges(node.id, edges);
  const incomingCount = connections.filter((edge) => edge.target === node.id).length;
  const outgoingCount = connections.length - incomingCount;
  const heading = incomingCount && outgoingCount ? copy.connections : incomingCount ? copy.connectedInputs : copy.connectedOutputs;
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
            <small>
              {edge.source === node.id
                ? formatCopyValue(copy.toNode, { node: edge.target })
                : formatCopyValue(copy.fromNode, { node: edge.source })}
            </small>
          </div>
        ))
      ) : (
        <p className={styles.mutedText}>{copy.noGraphConnections}</p>
      )}
    </div>
  );
}
