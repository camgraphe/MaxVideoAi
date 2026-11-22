import { query } from '@/lib/db';
import {
  MILO_MEDIA_PAGE_SIZE,
  miloAttachments,
  type MobileMiloSession,
  type MiloMediaRead,
} from '@/lib/mobile-milo-media';
import type { PromptAssistanceRequest, PromptReferenceLocation } from '@/lib/prompt-assistance/contract';
import type { PromptSessionSnapshot } from '@/lib/prompt-assistance/session';
import { resolveLibraryOrganizationReferences } from '@/server/media-library/organization-resolver';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { MobileHttpError } from './errors';

type References = PromptAssistanceRequest['draft']['references'];
type Submitted = References[number];

/** Read only the submitted slots of requests already returned by the owned session reader. */
export async function withMobileMiloAttachments(
  userId: string,
  session: PromptSessionSnapshot,
): Promise<MobileMiloSession> {
  const ids = session.turns.map((turn) => turn.requestId);
  if (session.pending) ids.push(session.pending.requestId);
  if (!ids.length) return session;
  const rows = await query<{ request_id: string; refs: References }>(
    `SELECT request_id,input_json#>'{draft,references}' AS refs FROM prompt_assistance_requests
     WHERE user_id=$1 AND session_id=$2 AND request_id=ANY($3::uuid[])`,
    [userId, session.sessionId, ids],
  );
  const markers = new Map(rows.map((row) => [row.request_id, miloAttachments(row.refs ?? [])]));
  const attach = <T extends { requestId: string }>(turn: T) => {
    const attachments = markers.get(turn.requestId);
    return attachments?.length ? { ...turn, attachments } : turn;
  };
  return {
    ...session,
    turns: session.turns.map(attach),
    pending: session.pending && attach(session.pending),
  };
}

async function readSubmitted(userId: string, sessionId: string, requestId: string) {
  const [row] = await query<{ refs: References }>(
    `SELECT input_json#>'{draft,references}' AS refs FROM prompt_assistance_requests
     WHERE user_id=$1 AND session_id=$2 AND request_id=$3 LIMIT 1`,
    [userId, sessionId, requestId],
  );
  if (!row) throw new MobileHttpError('REQUEST_NOT_FOUND', 404, 'Message unavailable.');
  return row.refs ?? [];
}

export async function readMobileMiloMedia(
  userId: string,
  sessionId: string,
  requestId: string,
  location?: PromptReferenceLocation,
  offset = 0,
): Promise<MiloMediaRead[]> {
  const refs = await readSubmitted(userId, sessionId, requestId);
  const requestRefs = refs.filter((r): r is Submitted & { ref: NonNullable<Submitted['ref']> } => !!r.ref);
  const selected = location
    ? requestRefs.filter((r) => r.fieldId === location.fieldId && r.slot === location.slot)
    : requestRefs.slice(offset, offset + MILO_MEDIA_PAGE_SIZE);
  if (!selected.length) return [];
  const visible = await resolveLibraryOrganizationReferences(
    userId,
    selected.map((item) => item.ref),
  );
  return Promise.all(
    selected.map(async ({ fieldId, slot, ref }, index): Promise<MiloMediaRead> => {
      const marker = { fieldId, slot, kind: ref.kind };
      const current = visible[index];
      if (!current?.key || current.error || current.state?.trashedAt)
        return { ...marker, state: 'unavailable' };
      try {
        const asset = await resolveStudioMedia(userId, ref);
        const grant = await createConversationMediaReadAccess(userId, asset);
        return {
          ...marker,
          state: 'ready',
          name: asset.originalName,
          thumbnail: grant.thumbnailAccessUrl,
          ...(location ? { original: grant.url } : {}),
        };
      } catch (error) {
        if (error instanceof Error && ['MEDIA_NOT_AVAILABLE', 'MEDIA_DELETED'].includes(error.message))
          return { ...marker, state: 'unavailable' };
        throw error;
      }
    }),
  );
}
