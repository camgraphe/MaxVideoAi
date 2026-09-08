import type {
  WorkspaceEdgeKind,
  WorkspaceInputConnector,
} from './workspace-types';

export type WorkspaceShotConnectorPresentationEntry = {
  handle: WorkspaceEdgeKind;
  connector: WorkspaceInputConnector | null;
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
    const entry = { handle, connector };
    if (!connector || typeof connector.connectedCount !== 'number' || connector.required || connector.connectedCount > 0) {
      visible.push(entry);
    } else {
      optionalEmpty.push(entry);
    }
  }

  return { visible, optionalEmpty };
}
