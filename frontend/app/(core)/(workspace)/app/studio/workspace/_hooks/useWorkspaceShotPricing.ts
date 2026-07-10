import { useEffect, useMemo, useState } from 'react';
import { runPreflight } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { validateShotConnections } from '../_lib/workspace-capabilities';
import {
  buildWorkspaceStoryboardImageEstimateRequest,
  buildWorkspaceShotPreflightRequest,
  errorWorkspacePricingEstimate,
  formatWorkspaceImagePricingEstimate,
  formatWorkspacePricingEstimate,
  loadingWorkspacePricingEstimate,
  unavailableWorkspacePricingEstimate,
  type WorkspaceImagePricingEstimateResponse,
} from '../_lib/workspace-pricing';
import { buildWorkspaceToolPricingEstimate } from '../_lib/workspace-tool-pricing';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspacePricingEstimate,
} from '../_lib/workspace-types';
import { inferWorkspaceEdgeKind } from '../_lib/workspace-templates';

const PRICING_DEBOUNCE_MS = 300;

type WorkspacePricingRequest = {
  kind: 'preflight';
  nodeId: string;
  key: string;
  request: ReturnType<typeof buildWorkspaceShotPreflightRequest>;
};

type WorkspaceLocalPricingRequest = {
  kind: 'local';
  nodeId: string;
  key: string;
  estimate: WorkspacePricingEstimate;
};

type WorkspaceImageEstimatePricingRequest = {
  kind: 'image-estimate';
  nodeId: string;
  key: string;
  request: ReturnType<typeof buildWorkspaceStoryboardImageEstimateRequest>;
};

type WorkspaceAnyPricingRequest =
  | WorkspacePricingRequest
  | WorkspaceLocalPricingRequest
  | WorkspaceImageEstimatePricingRequest;

type UseWorkspaceShotPricingOptions = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  capabilities: WorkspaceModelCapability[];
};

function connectedInputKinds(nodeId: string, edges: WorkspaceGraphEdge[]): WorkspaceEdgeKind[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle))
    .filter((kind) => kind !== 'generated_output' && kind !== 'output_to_timeline');
}

function promptTextForNode(nodeId: string, nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): string {
  const promptKinds = new Set<WorkspaceEdgeKind>(['prompt', 'style', 'camera', 'dialogue', 'narration']);
  return edges
    .filter((edge) => edge.target === nodeId)
    .filter((edge) => {
      const kind = edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle);
      return promptKinds.has(kind);
    })
    .map((edge) => nodes.find((node) => node.id === edge.source)?.data.promptText)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join('\n\n');
}

function pricingRequestKey(request: WorkspacePricingRequest['request']): string {
  return JSON.stringify({
    engine: request.engine,
    mode: request.mode,
    durationSec: request.durationSec,
    resolution: request.resolution,
    aspectRatio: request.aspectRatio,
    fps: request.fps,
    seedLocked: request.seedLocked,
    audio: request.audio,
    voiceControl: request.voiceControl,
    memberTier: request.user?.memberTier,
  });
}

function imagePricingRequestKey(request: WorkspaceImageEstimatePricingRequest['request']): string {
  return JSON.stringify(request);
}

export function useWorkspaceShotPricing({
  nodes,
  edges,
  capabilities,
}: UseWorkspaceShotPricingOptions): Record<string, WorkspacePricingEstimate> {
  const [memberTier, setMemberTier] = useState('Member');
  const [estimates, setEstimates] = useState<Record<string, WorkspacePricingEstimate>>({});

  useEffect(() => {
    let canceled = false;
    void authFetch('/api/member-status')
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (canceled) return;
        const tier = typeof json?.tier === 'string' && json.tier.trim().length ? json.tier : 'Member';
        setMemberTier(tier);
      })
      .catch(() => {
        if (!canceled) setMemberTier('Member');
      });
    return () => {
      canceled = true;
    };
  }, []);

  const pricingRequests = useMemo<WorkspaceAnyPricingRequest[]>(() => {
    return nodes
      .flatMap((node) => {
        if (node.data.kind === 'chat') {
          const estimate = unavailableWorkspacePricingEstimate('Studio chat pricing is unavailable.');
          return [{
            kind: 'local' as const,
            nodeId: node.id,
            estimate,
            key: JSON.stringify({ status: estimate.status, label: estimate.label, error: estimate.error }),
          }];
        }
        if (node.data.kind !== 'shot' || !node.data.shot) return [];
        const settings = node.data.shot;
        const connectedInputs = connectedInputKinds(node.id, edges);
        const validation = validateShotConnections({
          settings,
          connectedInputs,
          capabilities,
        });
        const toolEstimate = buildWorkspaceToolPricingEstimate({
          settings,
          validation,
          prompt: promptTextForNode(node.id, nodes, edges),
          connectedInputs,
        });
        if (toolEstimate) {
          return [{
            kind: 'local' as const,
            nodeId: node.id,
            estimate: toolEstimate,
            key: JSON.stringify({
              status: toolEstimate.status,
              label: toolEstimate.label,
              totalCents: toolEstimate.totalCents,
              currency: toolEstimate.currency,
              settings,
              connectedInputs,
            }),
          }];
        }
        if (settings.toolKind === 'storyboard') {
          const request = buildWorkspaceStoryboardImageEstimateRequest({ settings });
          return [{
            kind: 'image-estimate' as const,
            nodeId: node.id,
            request,
            key: imagePricingRequestKey(request),
          }];
        }
        const request = buildWorkspaceShotPreflightRequest({
          settings,
          connectedInputs,
          capability: validation.capability,
          memberTier,
        });
        return [{
          kind: 'preflight' as const,
          nodeId: node.id,
          request,
          key: pricingRequestKey(request),
        }];
      })
      .filter((request): request is WorkspaceAnyPricingRequest => Boolean(request));
  }, [capabilities, edges, memberTier, nodes]);

  useEffect(() => {
    if (!pricingRequests.length) {
      setEstimates({});
      return undefined;
    }

    let canceled = false;
    const activeNodeIds = new Set(pricingRequests.map((request) => request.nodeId));
    setEstimates((current) =>
      pricingRequests.reduce<Record<string, WorkspacePricingEstimate>>((next, request) => {
        next[request.nodeId] = request.kind === 'local'
          ? request.estimate
          : loadingWorkspacePricingEstimate(current[request.nodeId]);
        return next;
      }, {})
    );

    const remoteRequests = pricingRequests.filter(
      (request): request is WorkspacePricingRequest | WorkspaceImageEstimatePricingRequest => request.kind !== 'local'
    );
    if (!remoteRequests.length) {
      return () => {
        canceled = true;
      };
    }

    const timeout = window.setTimeout(() => {
      void Promise.all(
        remoteRequests.map(async (pricingRequest) => {
          try {
            if (pricingRequest.kind === 'image-estimate') {
              const response = await authFetch('/api/images/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pricingRequest.request),
              });
              const payload = (await response.json().catch(() => null)) as WorkspaceImagePricingEstimateResponse | null;
              if (!response.ok || !payload?.ok) {
                return [
                  pricingRequest.nodeId,
                  formatWorkspaceImagePricingEstimate(
                    payload ?? { error: `Storyboard price estimate failed (${response.status})` }
                  ),
                ] as const;
              }
              return [pricingRequest.nodeId, formatWorkspaceImagePricingEstimate(payload)] as const;
            }
            const response = await runPreflight(pricingRequest.request);
            return [pricingRequest.nodeId, formatWorkspacePricingEstimate(response)] as const;
          } catch (error) {
            return [pricingRequest.nodeId, errorWorkspacePricingEstimate(error)] as const;
          }
        })
      ).then((results) => {
        if (canceled) return;
        setEstimates((current) =>
          results.reduce<Record<string, WorkspacePricingEstimate>>((next, [nodeId, estimate]) => {
            if (activeNodeIds.has(nodeId)) {
              next[nodeId] = estimate;
            }
            return next;
          }, { ...current })
        );
      });
    }, PRICING_DEBOUNCE_MS);

    return () => {
      canceled = true;
      window.clearTimeout(timeout);
    };
  }, [pricingRequests]);

  return estimates;
}
