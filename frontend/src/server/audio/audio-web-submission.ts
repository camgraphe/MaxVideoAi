import { createHash } from 'node:crypto';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import type { AudioGenerateRequestBody, AudioGenerateResponse, AudioOutputKind } from '@/lib/audio-generation';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { createInitialAudioJobInExecutor } from './audio-generate-jobs';
import { AudioGenerationError, validateAudioGenerateRequest } from './audio-generate-validation';
import type { buildAudioRunReservation } from './audio-run-reservation';

type Identity = { jobId: string; inputHash: string; userId: string };
type Reservation = ReturnType<typeof buildAudioRunReservation>;
export function audioWebSubmissionIdentity(userId: string, body: AudioGenerateRequestBody): Identity | null {
  if (body.submissionId === undefined) return null;
  if (typeof body.submissionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submissionId)) {
    throw new AudioGenerationError('Invalid Audio submission identity.', { status: 400, code: 'audio_submission_invalid' });
  }
  return { userId, jobId: `aud_${createHash('sha256').update(`${userId}:${body.submissionId.toLowerCase()}`).digest('hex').slice(0, 32)}`,
    inputHash: createHash('sha256').update(JSON.stringify(validateAudioGenerateRequest(body))).digest('hex') };
}

export async function readAudioWebSubmission(identity: Identity, executor: QueryExecutor = { query }): Promise<AudioGenerateResponse | null> {
  const rows = await executor.query<{
    job_id: string; status: string; progress: number | null; audio_url: string | null; video_url: string | null; thumb_url: string | null;
    payment_status: string; settings_snapshot: { audioSubmissionInputHash?: string; outputKind: AudioOutputKind; measuredDurationSec?: number | null;
      requestedDurationSec?: number | null; providers?: Record<string, unknown>; sourceJobId?: string | null }; pricing_snapshot: PricingSnapshot;
  }>('SELECT job_id,status,progress,audio_url,video_url,thumb_url,payment_status,settings_snapshot,pricing_snapshot FROM app_jobs WHERE job_id=$1 AND user_id=$2', [identity.jobId, identity.userId]);
  const row = rows[0];
  if (!row) return null;
  const settings = row.settings_snapshot;
  if (settings?.audioSubmissionInputHash !== identity.inputHash) {
    throw new AudioGenerationError('This Audio submission belongs to different settings.', { status: 409, code: 'audio_submission_conflict' });
  }
  const complete = row.status === 'completed';
  return { ok: true, jobId: row.job_id, status: complete ? 'completed' : row.status === 'failed' ? 'failed' : 'pending',
    audioUrl: complete ? row.audio_url : null, videoUrl: complete ? row.video_url : null, thumbUrl: row.thumb_url,
    outputKind: settings.outputKind, progress: row.progress ?? 0, durationSec: settings.measuredDurationSec ?? null,
    requestedDurationSec: settings.requestedDurationSec ?? null, providers: settings.providers ?? {},
    pricing: row.pricing_snapshot, paymentStatus: row.payment_status, sourceJobId: settings.sourceJobId ?? null };
}

/** The lock, replay check, job and wallet debit share one transaction. Only its winner executes. */
export async function reserveAudioWebSubmission(identity: Identity, reservation: Reservation): Promise<AudioGenerateResponse | null> {
  const settings = { ...reservation.execution.initialSettingsSnapshot, audioSubmissionInputHash: identity.inputHash };
  reservation.initialJob.jobId = identity.jobId;
  reservation.initialJob.settingsSnapshotJson = JSON.stringify(settings);
  reservation.execution.jobId = identity.jobId;
  reservation.execution.initialSettingsSnapshot = settings;
  return withDbTransaction(async executor => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [identity.jobId]);
    const replay = await readAudioWebSubmission(identity, executor);
    if (replay) return replay;
    await createInitialAudioJobInExecutor(executor, reservation.initialJob);
    return null;
  });
}
