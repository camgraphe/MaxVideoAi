import { MAX_IMAGE_UPLOAD_BYTES } from '@/server/uploads/store-image-upload';
import {
  audioUploadLimitBytes,
} from '@/server/uploads/store-media-upload';
import {
  videoUploadLimitBytes,
} from '@/app/api/uploads/video/_lib/video-upload-limits';

import { AgentApiError } from './errors';
import type { AgentPrincipal } from './principal';
import type { CanonicalReferenceMediaKind } from './generation-types';
import {
  createUploadSession,
  type CreatedReferenceUploadSession,
} from './reference-upload-sessions';
import { buildAgentAccountDestinations } from './account-destinations';
import type { AgentOpenUrlDestination } from './types';

export const REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  video: ['video/mp4', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'],
} as const satisfies Record<CanonicalReferenceMediaKind, readonly string[]>;

export type CreateReferenceUploadLinkInput = {
  kind: CanonicalReferenceMediaKind;
};

export type ReferenceUploadPolicy = Readonly<{
  accepted: readonly string[];
  maxBytes: number;
}>;

export function getReferenceUploadPolicy(
  mediaKind: CanonicalReferenceMediaKind,
): ReferenceUploadPolicy {
  if (mediaKind === 'image') {
    return { accepted: REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES.image, maxBytes: MAX_IMAGE_UPLOAD_BYTES };
  }
  if (mediaKind === 'video') {
    return { accepted: REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES.video, maxBytes: videoUploadLimitBytes() };
  }
  return { accepted: REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES.audio, maxBytes: audioUploadLimitBytes() };
}

export type ReferenceUploadLink = {
  destination: AgentOpenUrlDestination;
  expiresAt: string;
  mediaKind: CanonicalReferenceMediaKind;
  accepted: string[];
  maxBytes: number;
  library: AgentOpenUrlDestination;
  nextAction: {
    tool: 'list_media';
    arguments: { kind: CanonicalReferenceMediaKind };
  };
};

type CreateReferenceUploadLinkDependencies = {
  baseUrl: string;
  createUploadSession(input: {
    userId: string;
    oauthClientId: string | null;
    mediaKind: CanonicalReferenceMediaKind;
  }): Promise<CreatedReferenceUploadSession>;
};

function requirePrincipal(principal: AgentPrincipal): void {
  if (
    principal?.authMethod !== 'oauth'
    || typeof principal.userId !== 'string'
    || principal.userId.length < 1
    || principal.userId.length > 128
    || principal.userId !== principal.userId.trim()
    || (principal.clientId !== null && (
      typeof principal.clientId !== 'string'
      || principal.clientId.length < 1
      || principal.clientId.length > 256
      || principal.clientId !== principal.clientId.trim()
    ))
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before uploading reference media.');
  }
}

export function createReferenceUploadLinkService(
  dependencies: CreateReferenceUploadLinkDependencies,
): (input: CreateReferenceUploadLinkInput, principal: AgentPrincipal) => Promise<ReferenceUploadLink> {
  const destinations = buildAgentAccountDestinations(dependencies.baseUrl);
  const origin = new URL(destinations.connections.url).origin;
  return async (input, principal) => {
    requirePrincipal(principal);
    if (!input || (input.kind !== 'image' && input.kind !== 'video' && input.kind !== 'audio')) {
      throw new AgentApiError('REFERENCE_INVALID', 'Choose an image, video, or audio reference.');
    }
    const policy = getReferenceUploadPolicy(input.kind);
    const created = await dependencies.createUploadSession({
      userId: principal.userId,
      oauthClientId: principal.clientId,
      mediaKind: input.kind,
    });
    if (created.session.mediaKind !== input.kind) {
      throw new Error('Reference upload session kind mismatch.');
    }
    return {
      destination: {
        type: 'open_url',
        purpose: 'reference_upload',
        label: `Upload a private ${input.kind} reference to MaxVideoAI`,
        url: `${origin}/mcp/reference-upload/${created.token}`,
      },
      expiresAt: created.session.expiresAt.toISOString(),
      mediaKind: input.kind,
      accepted: [...policy.accepted],
      maxBytes: policy.maxBytes,
      library: destinations.library,
      nextAction: { tool: 'list_media', arguments: { kind: input.kind } },
    };
  };
}

export function createDefaultReferenceUploadLinkService(
  baseUrl: string,
): (input: CreateReferenceUploadLinkInput, principal: AgentPrincipal) => Promise<ReferenceUploadLink> {
  return createReferenceUploadLinkService({
    baseUrl,
    createUploadSession: (input) => createUploadSession(input),
  });
}
