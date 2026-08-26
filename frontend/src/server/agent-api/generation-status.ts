import {
  getGenerationStatus,
  type AgentGenerationResult,
  type AgentGenerationStatus,
} from '@/server/generations/generation-status';
import {
  listRecentGenerations,
  RecentGenerationInputError,
  type RecentGenerationsResult,
} from '@/server/generations/recent-generations';

import { AgentApiError } from './errors';
import {
  buildAgentAccountDestinations,
  buildAgentGenerationDestination,
} from './account-destinations';
import type { AgentPrincipal } from './principal';
import type { AgentOpenUrlDestination } from './types';
import { readTrialJobStatus } from './trial-outcomes';

const MAX_JOB_ID_CHARS = 256;
const MAX_CURSOR_CHARS = 256;
const MAX_RECENT_LIMIT = 20;
const DEFAULT_RECENT_LIMIT = 10;
const MAX_PRIMARY_OUTPUTS = 4;
const MAX_THUMBNAILS = 4;
const MAX_RESOURCE_URI_CHARS = 2048;
const MIN_RETRY_SECONDS = 5;
const MAX_RETRY_SECONDS = 30;
const DEFAULT_ACCOUNT_URL = 'https://maxvideoai.com/account/connections';

export type AgentGenerationRetry = {
  tool: 'get_generation_status';
  arguments: { jobId: string };
  afterSeconds: number;
};

export type AgentGenerationRecovery = Omit<AgentGenerationStatus, 'retryAfterSeconds' | 'result'> & {
  result: AgentGenerationResult | null;
  library: AgentOpenUrlDestination;
  workspace: AgentOpenUrlDestination;
  savedToLibrary: boolean;
  retry: AgentGenerationRetry | null;
};

export type AgentGenerationRecoveryPage = {
  items: AgentGenerationRecovery[];
  nextCursor: string | null;
};

export type AgentGenerationResourceLink = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
};

export type GetAgentGenerationStatusInput = { jobId: string };

export type ListAgentRecentGenerationsInput = {
  cursor?: string;
  limit?: number;
  surface?: 'video' | 'image';
  status?: AgentGenerationStatus['status'];
};

type StatusReader = typeof getGenerationStatus;
type RecentReader = typeof listRecentGenerations;
type TrialStatusReader = typeof readTrialJobStatus;

export type AgentGenerationStatusDependencies = {
  readStatus?: StatusReader;
  readTrialStatus?: TrialStatusReader;
  accountUrl?: string;
};

export type AgentRecentGenerationsDependencies = {
  listRecent?: RecentReader;
  readTrialStatus?: TrialStatusReader;
  accountUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactObject(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  message: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new AgentApiError('PARAMETER_INVALID', message);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))
    || keys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return !descriptor || !descriptor.enumerable || !('value' in descriptor);
    })
  ) throw new AgentApiError('PARAMETER_INVALID', message);
  return value;
}

function requirePrincipal(principal: AgentPrincipal): void {
  const safeIdentifier = (value: unknown, maxLength: number) => typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim();
  if (
    !principal
    || principal.authMethod !== 'oauth'
    || !safeIdentifier(principal.userId, 128)
    || (principal.clientId !== null && !safeIdentifier(principal.clientId, 256))
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before recovering generations.');
  }
}

function normalizeJobId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AgentApiError('PARAMETER_INVALID', 'jobId must be a non-empty string.');
  }
  const jobId = value.trim();
  if (!jobId || jobId.length > MAX_JOB_ID_CHARS) {
    throw new AgentApiError('PARAMETER_INVALID', 'jobId must contain at most 256 characters.');
  }
  return jobId;
}

function normalizePublicUri(value: unknown, seen: Set<string>): string | null {
  if (typeof value !== 'string' || value.length > MAX_RESOURCE_URI_CHARS) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.hash
      || (parsed.port && parsed.port !== '443')
    ) {
      return null;
    }
    const canonical = parsed.toString();
    if (canonical.length > MAX_RESOURCE_URI_CHARS || seen.has(canonical)) return null;
    seen.add(canonical);
    return canonical;
  } catch {
    return null;
  }
}

function boundedUris(values: ReadonlyArray<string | null>, limit: number, seen: Set<string>): string[] {
  const bounded: string[] = [];
  for (const value of values) {
    const uri = normalizePublicUri(value, seen);
    if (!uri) continue;
    bounded.push(uri);
    if (bounded.length >= limit) break;
  }
  return bounded;
}

function boundedResult(result: AgentGenerationResult | null): AgentGenerationResult | null {
  if (!result) return null;
  const seen = new Set<string>();
  if (result.surface === 'image') {
    const imageUrls = boundedUris(result.imageUrls, MAX_PRIMARY_OUTPUTS, seen);
    if (!imageUrls.length) return null;
    return {
      surface: 'image',
      imageUrls,
      thumbnailUrls: boundedUris(result.thumbnailUrls, MAX_THUMBNAILS, seen),
    };
  }
  const videoUrl = boundedUris([result.videoUrl], 1, seen)[0];
  if (!videoUrl) return null;
  return {
    surface: 'video',
    videoUrl,
    previewUrl: boundedUris([result.previewUrl], 1, seen)[0] ?? null,
    thumbnailUrl: boundedUris([result.thumbnailUrl], 1, seen)[0] ?? null,
    audioUrl: boundedUris([result.audioUrl], 1, seen)[0] ?? null,
  };
}

function retryDelay(value: number | null): number {
  if (!Number.isFinite(value)) return MIN_RETRY_SECONDS;
  return Math.max(MIN_RETRY_SECONDS, Math.min(MAX_RETRY_SECONDS, Math.round(value ?? MIN_RETRY_SECONDS)));
}

async function enrichIncludedTrialStatus(
  status: AgentGenerationStatus,
  userId: string,
  reader: TrialStatusReader,
): Promise<AgentGenerationStatus> {
  if (status.paymentStatus !== 'included_mcp_trial') return status;
  if (status.funding === 'included_trial' && status.entitlementState) {
    return { ...status, paymentStatus: 'included_trial' };
  }
  const trial = await reader({ userId, jobId: status.jobId });
  if (!trial) throw new Error('Included trial lifecycle state is unavailable.');
  return { ...status, paymentStatus: 'included_trial', ...trial };
}

export function buildAgentGenerationRecovery(
  status: AgentGenerationStatus,
  accountUrl = DEFAULT_ACCOUNT_URL,
): AgentGenerationRecovery {
  const { retryAfterSeconds, ...safeStatus } = status;
  const destinations = buildAgentAccountDestinations(accountUrl);
  const retry = status.status === 'accepted' || status.status === 'running'
    ? {
        tool: 'get_generation_status' as const,
        arguments: { jobId: status.jobId },
        afterSeconds: retryDelay(retryAfterSeconds),
      }
    : null;
  return {
    ...safeStatus,
    result: status.status === 'completed' ? boundedResult(status.result) : null,
    library: destinations.library,
    workspace: buildAgentGenerationDestination(accountUrl, status.surface, status.jobId),
    savedToLibrary: status.status === 'completed',
    retry,
  };
}

function mimeType(
  uri: string,
  role: 'output' | 'thumbnail' | 'preview' | 'audio',
  surface: 'video' | 'image',
): string {
  const path = new URL(uri).pathname.toLowerCase();
  if (role === 'audio') {
    if (path.endsWith('.wav')) return 'audio/wav';
    if (path.endsWith('.m4a')) return 'audio/mp4';
    if (path.endsWith('.ogg')) return 'audio/ogg';
    return path.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream';
  }
  if (role === 'thumbnail' || role === 'output') {
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.webp')) return 'image/webp';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    if (surface === 'image' || role === 'thumbnail') return 'application/octet-stream';
  }
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mov')) return 'video/quicktime';
  return path.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream';
}

function resource(
  recovery: AgentGenerationRecovery,
  uri: string,
  role: 'output' | 'thumbnail' | 'preview' | 'audio',
  index?: number,
): AgentGenerationResourceLink {
  const suffix = index === undefined ? '' : ` ${index + 1}`;
  return {
    uri,
    name: `MaxVideoAI ${role}${suffix}`,
    description: `${role} for generation ${recovery.jobId}`,
    mimeType: mimeType(uri, role, recovery.surface),
  };
}

export function buildGenerationResourceLinks(
  recovery: AgentGenerationRecovery,
): AgentGenerationResourceLink[] {
  if (recovery.status !== 'completed' || !recovery.result) return [];
  if (recovery.result.surface === 'image') {
    return [
      ...recovery.result.imageUrls.map((uri, index) => resource(recovery, uri, 'output', index)),
      ...recovery.result.thumbnailUrls.map((uri, index) => resource(recovery, uri, 'thumbnail', index)),
    ];
  }
  return [
    resource(recovery, recovery.result.videoUrl, 'output'),
    ...(recovery.result.previewUrl ? [resource(recovery, recovery.result.previewUrl, 'preview')] : []),
    ...(recovery.result.thumbnailUrl ? [resource(recovery, recovery.result.thumbnailUrl, 'thumbnail')] : []),
    ...(recovery.result.audioUrl ? [resource(recovery, recovery.result.audioUrl, 'audio')] : []),
  ];
}

export async function getAgentGenerationStatus(
  input: GetAgentGenerationStatusInput,
  principal: AgentPrincipal,
  dependencies: AgentGenerationStatusDependencies = {},
): Promise<AgentGenerationRecovery> {
  requirePrincipal(principal);
  const record = requireExactObject(input, new Set(['jobId']), 'Only jobId is accepted.');
  const jobId = normalizeJobId(record.jobId);
  const status = await (dependencies.readStatus ?? getGenerationStatus)({
    userId: principal.userId,
    jobId,
  });
  if (!status) throw new AgentApiError('JOB_FAILED', 'Generation not found.');
  return buildAgentGenerationRecovery(
    await enrichIncludedTrialStatus(
      status,
      principal.userId,
      dependencies.readTrialStatus ?? readTrialJobStatus,
    ),
    dependencies.accountUrl ?? DEFAULT_ACCOUNT_URL,
  );
}

function normalizeRecentInput(input: ListAgentRecentGenerationsInput): Required<
  Pick<ListAgentRecentGenerationsInput, 'limit'>
> & Omit<ListAgentRecentGenerationsInput, 'limit'> {
  const record = requireExactObject(
    input,
    new Set(['cursor', 'limit', 'surface', 'status']),
    'The recent generation filters are invalid.',
  );
  const cursor = record.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > MAX_CURSOR_CHARS)) {
    throw new AgentApiError('PARAMETER_INVALID', 'cursor must contain at most 256 characters.');
  }
  const limit = record.limit ?? DEFAULT_RECENT_LIMIT;
  if (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_RECENT_LIMIT) {
    throw new AgentApiError('PARAMETER_INVALID', 'limit must be an integer from 1 to 20.');
  }
  if (record.surface !== undefined && record.surface !== 'video' && record.surface !== 'image') {
    throw new AgentApiError('PARAMETER_INVALID', 'surface must be video or image.');
  }
  const statuses = new Set(['accepted', 'running', 'completed', 'failed']);
  if (record.status !== undefined && !statuses.has(String(record.status))) {
    throw new AgentApiError('PARAMETER_INVALID', 'status is invalid.');
  }
  return {
    ...(cursor === undefined ? {} : { cursor }),
    limit: limit as number,
    ...(record.surface === undefined ? {} : { surface: record.surface as 'video' | 'image' }),
    ...(record.status === undefined
      ? {}
      : { status: record.status as AgentGenerationStatus['status'] }),
  };
}

export async function listAgentRecentGenerations(
  input: ListAgentRecentGenerationsInput,
  principal: AgentPrincipal,
  dependencies: AgentRecentGenerationsDependencies = {},
): Promise<AgentGenerationRecoveryPage> {
  requirePrincipal(principal);
  const normalized = normalizeRecentInput(input);
  let page: RecentGenerationsResult;
  try {
    page = await (dependencies.listRecent ?? listRecentGenerations)({
      userId: principal.userId,
      ...normalized,
    });
  } catch (error) {
    if (error instanceof RecentGenerationInputError) {
      throw new AgentApiError('PARAMETER_INVALID', 'cursor is invalid.');
    }
    throw error;
  }
  const enrichedItems = await Promise.all(page.items.map((status) => enrichIncludedTrialStatus(
    status,
    principal.userId,
    dependencies.readTrialStatus ?? readTrialJobStatus,
  )));
  return {
    items: enrichedItems.map((status) => buildAgentGenerationRecovery(
      status,
      dependencies.accountUrl ?? DEFAULT_ACCOUNT_URL,
    )),
    nextCursor: page.nextCursor,
  };
}
