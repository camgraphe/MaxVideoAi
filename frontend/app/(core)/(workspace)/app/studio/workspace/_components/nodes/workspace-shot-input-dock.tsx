'use client';

import { Handle, Position } from '@xyflow/react';
import { inputHandles, outputHandles } from './workspace-node-frame';
import styles from '../../_styles/canvas-nodes.module.css';
import type { WorkspaceEdgeKind, WorkspaceGraphNode, WorkspaceInputConnector } from '../../_lib/workspace-types';
import { edgeLabel, WORKSPACE_EDGE_COLORS } from '../../_lib/workspace-templates';
import { DEFAULT_STUDIO_COPY, localizeStudioEdgeKindLabel } from '../../../_lib/studio-copy';

function nodeCopy(data: WorkspaceGraphNode['data']): NonNullable<WorkspaceGraphNode['data']['studioCanvasCopy']>['nodes'] {
  return data.studioCanvasCopy?.nodes ?? DEFAULT_STUDIO_COPY.canvas.nodes;
}

function connectorLabel(
  handle: WorkspaceEdgeKind,
  connectors: WorkspaceInputConnector[],
  copy: ReturnType<typeof nodeCopy>
): string {
  return connectors.find((connector) => connector.kind === handle)?.label ??
    (copy ? localizeStudioEdgeKindLabel(handle, copy) : edgeLabel(handle));
}

function connectorRequired(handle: WorkspaceEdgeKind, connectors: WorkspaceInputConnector[]): boolean {
  return Boolean(connectors.find((connector) => connector.kind === handle)?.required);
}

function connectorCapacity(handle: WorkspaceEdgeKind, connectors: WorkspaceInputConnector[]): Pick<WorkspaceInputConnector, 'capacityLabel' | 'remainingCount'> {
  const connector = connectors.find((candidate) => candidate.kind === handle);
  return {
    capacityLabel: connector?.capacityLabel ?? null,
    remainingCount: connector?.remainingCount,
  };
}

export function ShotInputDock({ data }: { data: WorkspaceGraphNode['data'] }) {
  const handles = inputHandles(data);
  const outputs = outputHandles(data);
  const connectors = Array.isArray(data.inputConnectors) ? data.inputConnectors : [];
  const copy = nodeCopy(data);
  if (!handles.length && !outputs.length) return null;
  return (
    <div className={styles.shotInputDock} data-shot-connector-dock="true">
      {handles.length ? (
        <div className={styles.shotConnectorGroup}>
          <span className={styles.shotInputLabel}>{copy.inputs}</span>
          {handles.map((handle) => {
            const color = WORKSPACE_EDGE_COLORS[handle] ?? '#8b5cf6';
            const label = connectorLabel(handle, connectors, copy);
            const { capacityLabel, remainingCount } = connectorCapacity(handle, connectors);
            const isFull = remainingCount === 0;
            return (
              <div
                key={`shot-input-${handle}`}
                className={`${styles.shotInputRow} ${isFull ? styles.shotInputRowDisabled : ''}`}
                data-shot-connector-kind={handle}
                data-shot-connector-row="input"
              >
                <Handle
                  id={handle}
                  type="target"
                  position={Position.Left}
                  className={`${styles.graphHandle} ${styles.shotInputRowHandle}`}
                  style={{
                    top: '50%',
                    left: -10,
                    borderColor: color,
                    background: color,
                    opacity: isFull ? 0.35 : 1,
                  }}
                  title={label}
                />
                <span className={styles.shotInputName}>
                  {label}
                  {connectorRequired(handle, connectors) ? ' *' : ''}
                </span>
                {capacityLabel ? <span className={styles.shotInputCapacity}>{capacityLabel}</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {outputs.length ? (
        <div className={styles.shotConnectorGroup}>
          <span className={styles.shotInputLabel}>{copy.outputs}</span>
          {outputs.map((handle) => {
            const color = WORKSPACE_EDGE_COLORS[handle] ?? '#8b5cf6';
            const label = connectorLabel(handle, connectors, copy);
            return (
              <div
                key={`shot-output-${handle}`}
                className={`${styles.shotInputRow} ${styles.shotOutputRow}`}
                data-shot-connector-kind={handle}
                data-shot-connector-row="output"
              >
                <span className={styles.shotInputName}>{label}</span>
                <Handle
                  id={handle}
                  type="source"
                  position={Position.Right}
                  className={`${styles.graphHandle} ${styles.shotInputRowHandle}`}
                  style={{
                    top: '50%',
                    right: -10,
                    borderColor: color,
                    background: color,
                  }}
                  title={label}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
