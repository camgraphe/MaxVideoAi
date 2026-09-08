import type {
  WorkspaceEdgeKind,
  WorkspaceInputConnector,
} from './workspace-types';

export type WorkspaceShotConnectorPresentationEntry = {
  handle: WorkspaceEdgeKind;
  connector: WorkspaceInputConnector | null;
  usedCount: number;
  maxCount: number;
  remainingCount: number;
  status: 'available' | 'connected' | 'full' | 'disabled' | 'missing_required';
};

export type WorkspaceShotConnectorPresentation = {
  visible: WorkspaceShotConnectorPresentationEntry[];
  optionalEmpty: WorkspaceShotConnectorPresentationEntry[];
};

export function projectWorkspaceShotConnectorPresentation(
  handles: readonly WorkspaceEdgeKind[],
  connectors: readonly WorkspaceInputConnector[],
): WorkspaceShotConnectorPresentation {
  const connectorsByKind = new Map(connectors.map((connector) => [connector.kind, connector]));
  const visible: WorkspaceShotConnectorPresentationEntry[] = [];
  const optionalEmpty: WorkspaceShotConnectorPresentationEntry[] = [];

  for (const handle of handles) {
    const connector = connectorsByKind.get(handle) ?? null;
    const usedCount = connector?.connectedCount ?? 0;
    const maxCount = connector?.maxCount ?? 1;
    const remainingCount = connector?.remainingCount ?? Math.max(0, maxCount - usedCount);
    const status: WorkspaceShotConnectorPresentationEntry['status'] = connector?.disabledReason
      ? 'disabled'
      : remainingCount === 0
        ? 'full'
        : usedCount > 0
          ? 'connected'
          : connector?.required
            ? 'missing_required'
            : 'available';
    const entry = { handle, connector, usedCount, maxCount, remainingCount, status };
    if (!connector || typeof connector.connectedCount !== 'number' || connector.required || connector.connectedCount > 0) {
      visible.push(entry);
    } else {
      optionalEmpty.push(entry);
    }
  }

  return { visible, optionalEmpty };
}
