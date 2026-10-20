import { resolveSeedanceWorkflowRequest, seedanceWorkflowEnabled, SeedanceWorkflowRequestError,
  type PreparedSeedanceWorkflow } from '@/server/seedance-workflow-request';
import type { CanonicalGenerationRequest } from './generation-types';
import { normalizeGenerationRequest, stableJson } from './generation-normalization';
import { AgentApiError } from './errors';

export function agentSeedanceWorkflowEnabled(): boolean {
  return seedanceWorkflowEnabled(process.env.MCP_RESOURCE_URL ?? 'https://api.maxvideoai.com/mcp');
}

export type AgentSeedanceWorkflowDependencies = Parameters<typeof resolveSeedanceWorkflowRequest>[1] & { enabled?: boolean };

/** Transport adapter only: account ownership, eligibility and inheritance stay with the web workflow owner. */
export async function resolveAgentSeedanceWorkflow(request: CanonicalGenerationRequest, userId: string,
  deps: AgentSeedanceWorkflowDependencies = {}): Promise<{ request: CanonicalGenerationRequest; workflow?: PreparedSeedanceWorkflow }> {
  if (!request.seedanceWorkflow) return { request };
  try {
    const workflow = await resolveSeedanceWorkflowRequest({ userId, engineId: request.engineId,
      enabled: deps.enabled ?? agentSeedanceWorkflowEnabled(), body: { ...request.settings,
        mode: request.mode, prompt: request.prompt, iterationCount: request.outputCount,
        seedanceWorkflow: request.seedanceWorkflow } }, deps);
    if (!workflow) throw new SeedanceWorkflowRequestError('Draft workflow is unavailable.');
    if (request.seedanceWorkflow.step === 'draft') return { request, workflow };
    const body = workflow.body;
    const settings: CanonicalGenerationRequest['settings'] = {};
    for (const key of ['durationSec', 'durationOption', 'resolution', 'aspectRatio', 'audio', 'fps', 'numFrames',
      'negativePrompt', 'cfgScale', 'seed', 'cameraFixed', 'safetyChecker']) {
      const value = body[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') settings[key] = value;
    }
    // Provider-owned final content never reimports or requotes the original attachments.
    return { workflow, request: normalizeGenerationRequest({ ...request, mode: body.mode, prompt: body.prompt,
      settings, references: [], outputCount: 1 }) };
  } catch (error) {
    if (error instanceof SeedanceWorkflowRequestError) {
      throw new AgentApiError('SEEDANCE_DRAFT_UNAVAILABLE', 'This native Draft workflow is unavailable, expired or already finalizing. Check the owned job status; never substitute ordinary 480p.');
    }
    throw error;
  }
}

export function seedanceWorkflowQuoteBinding(workflow?: PreparedSeedanceWorkflow): Record<string, unknown> {
  return workflow?.seedanceFinal ? { seedanceWorkflow: {
    draftJobId: workflow.seedanceFinal.draftJobId,
    parentSnapshotFingerprint: workflow.seedanceFinal.parentSnapshotFingerprint ?? null,
  } } : {};
}

export function assertSeedanceWorkflowQuoteBinding(request: CanonicalGenerationRequest, inherited: CanonicalGenerationRequest,
  stored: Record<string, unknown>, workflow?: PreparedSeedanceWorkflow): void {
  if (stableJson(request) !== stableJson(inherited)
    || stableJson(stored.seedanceWorkflow ?? null) !== stableJson(seedanceWorkflowQuoteBinding(workflow).seedanceWorkflow ?? null)) {
    throw new AgentApiError('QUOTE_EXPIRED', 'The Draft facts changed. Prepare a fresh exact final quote and obtain new approval.');
  }
}
