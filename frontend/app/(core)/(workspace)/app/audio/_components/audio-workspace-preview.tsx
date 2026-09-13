'use client';

import { GenerationPendingStatus } from '@/components/groups/GenerationPendingStatus';
import { AppGlyph } from '@/components/app/AppGlyph';
import { WorkspaceEmptyPreview } from '@/components/composer/WorkspaceEmptyPreview.client';
import type { AudioWorkspaceCopy } from '../copy';
import type { ActiveAudioJobState, AudioResultState } from '../_lib/audio-workspace-types';

export interface AudioWorkspacePreviewProps {
  activeJob?: ActiveAudioJobState | null;
  result?: AudioResultState | null;
  awaitingJob?: boolean;
  copy: AudioWorkspaceCopy;
}

/** Presentation consumes the existing polling/result owners; it never infers provider percentages. */
export function AudioWorkspacePreview({ activeJob, result, awaitingJob = false, copy }: AudioWorkspacePreviewProps) {
  const inFlight = activeJob?.status === 'pending' || activeJob?.status === 'running';
  const failed = !awaitingJob && activeJob?.status === 'failed';
  const completed = activeJob?.status === 'completed'
    ? activeJob.videoUrl || activeJob.audioUrl ? activeJob : result?.jobId === activeJob.jobId ? result : null
    : result;
  const media = !inFlight && !failed && !awaitingJob ? completed : null;
  const hasMedia = Boolean(media?.videoUrl || media?.audioUrl);
  const status = hasMedia ? 'completed' : failed ? 'failed' : inFlight ? activeJob.status : awaitingJob || activeJob || result ? 'pending' : 'empty';

  return (
    <section className="app-audio-preview" aria-label={copy.hero.title} data-audio-preview-state={status}>
      {status === 'empty' ? <WorkspaceEmptyPreview media="audio" /> : (
        <div className="app-audio-preview-content">
          <div className="app-audio-preview-status" role={failed ? 'alert' : 'status'}>
            <AppGlyph name={media?.videoUrl ? 'video' : 'audio'} />
            {!inFlight ? <span>{copy.rail.statuses[status]}</span> : null}
          </div>
          {inFlight ? <GenerationPendingStatus observation={activeJob.observation ?? { stage: activeJob.status === 'running' ? 'processing' : 'pending' }} startedAt={activeJob.startedAt} etaSeconds={activeJob.etaSeconds} etaSource={activeJob.etaSource} /> : null}
          {hasMedia ? <>
            {media?.videoUrl ? <video controls preload="none" src={media.videoUrl} poster={media.thumbUrl ?? undefined} aria-label={copy.rail.outputs.video} /> : null}
            {media?.audioUrl ? <audio controls preload="none" src={media.audioUrl} aria-label={copy.rail.outputs.audio} /> : null}
            <a href={media?.videoUrl ?? media?.audioUrl ?? undefined} target="_blank" rel="noreferrer" className="app-audio-preview-file">{copy.rail.file}</a>
          </> : null}
        </div>
      )}
    </section>
  );
}
