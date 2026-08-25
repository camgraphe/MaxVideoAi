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
  uploadUrl: string;
  expiresAt: string;
  mediaKind: CanonicalReferenceMediaKind;
  accepted: string[];
  maxBytes: number;
  nextAction: string;
};

type CreateReferenceUploadLinkDependencies = {
  baseUrl: string;
  createUploadSession(input: {
    userId: string;
    oauthClientId: string | null;
    mediaKind: CanonicalReferenceMediaKind;
  }): Promise<CreatedReferenceUploadSession>;
};

function requireOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid reference upload base URL.');
  }
  if (
    (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))
    || parsed.username
    || parsed.password
  ) {
    throw new Error('Invalid reference upload base URL.');
  }
  return parsed.origin;
}

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
  const origin = requireOrigin(dependencies.baseUrl);
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
      uploadUrl: `${origin}/mcp/reference-upload/${created.token}`,
      expiresAt: created.session.expiresAt.toISOString(),
      mediaKind: input.kind,
      accepted: [...policy.accepted],
      maxBytes: policy.maxBytes,
      nextAction: `Open the URL, upload one ${input.kind === 'audio' ? 'audio file' : input.kind}, then call list_media.`,
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
