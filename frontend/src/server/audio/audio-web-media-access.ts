import { readOwnedGenerationRecord } from '@/server/generations/generation-status';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';

type AudioMediaKind = 'audio' | 'video' | 'source';

/** Read-only delivery: resolve the persisted original by account/job, then grant temporary access. */
export async function resolveAudioWebMedia(
  input: { userId: string; jobId: string; kind: AudioMediaKind },
  dependencies: { read?: typeof readOwnedGenerationRecord } = {},
): Promise<{ url: string } | null> {
  const read = dependencies.read ?? readOwnedGenerationRecord;
  const job = await read({ userId: input.userId, jobId: input.jobId });
  if (!job || job.user_id !== input.userId || job.job_id !== input.jobId || job.surface !== 'audio'
    || (input.kind !== 'source' && job.status !== 'completed')) return null;
  const settings = job.settings_snapshot as { sourceJobId?: unknown; sourceVideoUrl?: unknown; refs?: { sourceVideoUrl?: unknown } } | null;
  let original = input.kind === 'video' ? job.video_url : input.kind === 'audio' ? job.audio_url
    : settings?.refs?.sourceVideoUrl ?? settings?.sourceVideoUrl;
  if (input.kind === 'source' && !original && typeof settings?.sourceJobId === 'string') {
    const source = await read({ userId: input.userId, jobId: settings.sourceJobId });
    if (source?.user_id === input.userId && source.job_id === settings.sourceJobId) original = source.video_url;
  }
  if (typeof original !== 'string' || !original) return null;
  try {
    const parsed = new URL(original);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  } catch { return null; }
  return { url: await createOwnedMediaReadUrl({ url: original, userId: input.userId }) };
}
