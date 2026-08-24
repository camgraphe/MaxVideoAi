import { MAX_IMAGE_UPLOAD_BYTES } from '@/server/uploads/store-image-upload';

import { AgentApiError } from './errors';
import type { AgentPrincipal } from './principal';
import {
  createUploadSession,
  type CreatedReferenceUploadSession,
} from './reference-upload-sessions';

export const REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type ReferenceUploadLink = {
  uploadUrl: string;
  expiresAt: string;
  accepted: Array<(typeof REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES)[number]>;
  maxBytes: number;
  nextAction: string;
};

type CreateReferenceUploadLinkDependencies = {
  baseUrl: string;
  createUploadSession(input: {
    userId: string;
    oauthClientId: string | null;
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
): (principal: AgentPrincipal) => Promise<ReferenceUploadLink> {
  const origin = requireOrigin(dependencies.baseUrl);
  return async (principal) => {
    requirePrincipal(principal);
    const created = await dependencies.createUploadSession({
      userId: principal.userId,
      oauthClientId: principal.clientId,
    });
    return {
      uploadUrl: `${origin}/mcp/reference-upload/${created.token}`,
      expiresAt: created.session.expiresAt.toISOString(),
      accepted: [...REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES],
      maxBytes: MAX_IMAGE_UPLOAD_BYTES,
      nextAction: 'Open the URL, upload one image, then call list_media.',
    };
  };
}

export function createDefaultReferenceUploadLinkService(
  baseUrl: string,
): (principal: AgentPrincipal) => Promise<ReferenceUploadLink> {
  return createReferenceUploadLinkService({
    baseUrl,
    createUploadSession: (input) => createUploadSession(input),
  });
}
