'use client';

import { Handle, Position, useNodeId, useUpdateNodeInternals } from '@xyflow/react';
import { useEffect, type CSSProperties } from 'react';
import { inputHandles, outputHandles } from './workspace-node-frame';
import styles from '../../_styles/canvas-nodes.module.css';
import type { WorkspaceEdgeKind, WorkspaceGraphNode, WorkspaceInputConnector } from '../../_lib/workspace-types';
import { edgeLabel, WORKSPACE_EDGE_COLORS } from '../../_lib/workspace-templates';
import { DEFAULT_STUDIO_COPY, localizeStudioEdgeKindLabel } from '../../../_lib/studio-copy';
import { projectWorkspaceShotConnectorPresentation } from '../../_lib/workspace-shot-connector-presentation';

const CONNECTOR_HANDLE_EDGE_OFFSET = -14;

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

function formatConnectorDescription(label: string, required: boolean, capacityLabel: string | null): string {
  const requiredLabel = required ? `${label} *` : label;
  return capacityLabel ? `${requiredLabel} · ${capacityLabel}` : requiredLabel;
}

function connectorCapacity(
  handle: WorkspaceEdgeKind,
  connectors: WorkspaceInputConnector[]
): { capacityLabel: string | null; remainingCount: number | undefined } {
  const connector = connectors.find((candidate) => candidate.kind === handle);
  return {
    capacityLabel: connector?.capacityLabel ?? null,
    remainingCount: connector?.remainingCount,
  };
}

export function ShotInputDock({ data }: { data: WorkspaceGraphNode['data'] }) {
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const handles = inputHandles(data);
  const outputs = outputHandles(data);
  const connectors = Array.isArray(data.inputConnectors) ? data.inputConnectors : [];
  const copy = nodeCopy(data);
  const presentation = projectWorkspaceShotConnectorPresentation(handles, connectors);
  const layoutSignal = `${presentation.visible.map(({ handle }) => handle).join('|')}::${presentation.optionalEmpty.map(({ handle }) => handle).join('|')}::${outputs.join('|')}`;
  useEffect(() => {
    if (nodeId) updateNodeInternals(nodeId);
  }, [layoutSignal, nodeId, updateNodeInternals]);
  if (!handles.length && !outputs.length) return null;
  return (
    <div className={styles.shotInputDock} data-shot-connector-dock="true">
      {handles.length ? (
        <div className={styles.shotConnectorGroup}>
          <span className={styles.shotInputLabel}>{copy.inputs}</span>
          {presentation.visible.map(({ handle }) => {
            const color = WORKSPACE_EDGE_COLORS[handle] ?? '#8b5cf6';
            const label = connectorLabel(handle, connectors, copy);
            const { capacityLabel, remainingCount } = connectorCapacity(handle, connectors);
            const required = connectorRequired(handle, connectors);
            const connectorDescription = formatConnectorDescription(label, required, capacityLabel);
            const isFull = remainingCount === 0;
            const disabledReason = connectors.find((connector) => connector.kind === handle)?.disabledReason;
            const isDisabled = isFull || Boolean(disabledReason);
            return (
              <div
                key={`shot-input-${handle}`}
                className={`${styles.shotInputRow} ${isDisabled ? styles.shotInputRowDisabled : ''}`}
                aria-label={disabledReason ?? connectorDescription}
                title={disabledReason ?? connectorDescription}
                data-shot-connector-kind={handle}
                data-shot-connector-row="input"
              >
                <Handle
                  id={handle}
                  type="target"
                  position={Position.Left}
                  aria-disabled={isDisabled}
                  className={`${styles.graphHandle} ${styles.shotInputRowHandle}`}
                  style={{
                    top: '50%',
                    left: CONNECTOR_HANDLE_EDGE_OFFSET,
                    transform: 'translate(-50%, -50%)',
                    borderColor: color,
                    '--workspace-handle-color': color,
                    opacity: isDisabled ? 0.35 : 1,
                  } as CSSProperties}
                  title={disabledReason ?? connectorDescription}
                  isConnectable={!isDisabled}
                />
                <span className={styles.shotInputName}>
                  {label}
                  {required ? ' *' : ''}
                </span>
                {capacityLabel ? <span className={styles.shotInputCapacity}>{capacityLabel}</span> : null}
                <button type="button" className={`${styles.connectorAction} nodrag`} data-canvas-connect-handle={handle} aria-label={`${copy.connections}: ${label}`}>{(connectors.find((connector) => connector.kind === handle)?.connectedCount ?? 0) > 0 ? copy.connections : copy.connectSource}</button>
              </div>
            );
          })}
          {presentation.optionalEmpty.length ? (
            <div className={styles.shotHiddenConnectorAnchors} aria-hidden="true">
              {presentation.optionalEmpty.map(({ handle, connector }) => {
                const color = WORKSPACE_EDGE_COLORS[handle] ?? '#8b5cf6';
                const isDisabled = connector?.remainingCount === 0 || Boolean(connector?.disabledReason);
                return (
                  <span key={`shot-hidden-input-${handle}`} className={styles.shotHiddenConnectorAnchor} data-shot-hidden-connector-anchor={handle}>
                    <Handle
                      id={handle}
                      type="target"
                      position={Position.Left}
                      tabIndex={-1}
                      aria-hidden="true"
                      className={`${styles.graphHandle} ${styles.shotHiddenHandle}`}
                      style={{
                        borderColor: color,
                        '--workspace-handle-color': color,
                      } as CSSProperties}
                      isConnectable={!isDisabled}
                    />
                  </span>
                );
              })}
            </div>
          ) : null}
          <button
            type="button"
            className={`${styles.shotConnectionsButton} nodrag`}
            data-canvas-connect-handle={presentation.optionalEmpty[0]?.handle ?? presentation.visible[0]?.handle}
            data-canvas-connections-fallback="true"
          >
            {copy.connections}{presentation.optionalEmpty.length ? ` · +${presentation.optionalEmpty.length}` : ''}
          </button>
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
                aria-label={label}
                title={label}
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
                    right: CONNECTOR_HANDLE_EDGE_OFFSET,
                    transform: 'translate(50%, -50%)',
                    borderColor: color,
                    '--workspace-handle-color': color,
                  } as CSSProperties}
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
