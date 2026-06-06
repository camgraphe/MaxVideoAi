import { useEffect, useMemo, useState } from 'react';
import { runPreflight } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { validateShotConnections } from '../_lib/workspace-capabilities';
import {
  buildWorkspaceShotPreflightRequest,
  errorWorkspacePricingEstimate,
  formatWorkspacePricingEstimate,
  loadingWorkspacePricingEstimate,
} from '../_lib/workspace-pricing';
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
  nodeId: string;
  key: string;
  request: ReturnType<typeof buildWorkspaceShotPreflightRequest>;
};

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

  const pricingRequests = useMemo<WorkspacePricingRequest[]>(() => {
    return nodes
      .filter((node) => node.data.kind === 'shot' && node.data.shot)
      .map((node) => {
        const settings = node.data.shot;
        if (!settings) return null;
        const connectedInputs = connectedInputKinds(node.id, edges);
        const validation = validateShotConnections({
          settings,
          connectedInputs,
          capabilities,
        });
        const request = buildWorkspaceShotPreflightRequest({
          settings,
          connectedInputs,
          capability: validation.capability,
          memberTier,
        });
        return {
          nodeId: node.id,
          request,
          key: pricingRequestKey(request),
        };
      })
      .filter((request): request is WorkspacePricingRequest => Boolean(request));
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
        next[request.nodeId] = loadingWorkspacePricingEstimate(current[request.nodeId]);
        return next;
      }, {})
    );

    const timeout = window.setTimeout(() => {
      void Promise.all(
        pricingRequests.map(async (pricingRequest) => {
          try {
            const response = await runPreflight(pricingRequest.request);
            return [pricingRequest.nodeId, formatWorkspacePricingEstimate(response)] as const;
          } catch (error) {
            return [pricingRequest.nodeId, errorWorkspacePricingEstimate(error)] as const;
          }
        })
      ).then((results) => {
        if (canceled) return;
        setEstimates(
          results.reduce<Record<string, WorkspacePricingEstimate>>((next, [nodeId, estimate]) => {
            if (activeNodeIds.has(nodeId)) {
              next[nodeId] = estimate;
            }
            return next;
          }, {})
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
