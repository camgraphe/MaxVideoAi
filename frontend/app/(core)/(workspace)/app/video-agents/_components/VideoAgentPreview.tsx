'use client';

import { Bookmark, Download, Play, RefreshCcw, Sparkles } from 'lucide-react';
import type { VideoAgentPreset, VideoAgentSettings } from '../_lib/video-agent-config';
import { VIDEO_AGENT_COPY } from '../_lib/video-agent-copy';
import type { VideoAgentConfirmation, VideoAgentFlowPhase, VideoAgentPrototypeResult } from '../_lib/video-agent-state';
import { VideoAgentPromptPreview } from './VideoAgentPromptPreview';

type VideoAgentPreviewProps = {
  confirmation: VideoAgentConfirmation | null;
  phase: VideoAgentFlowPhase;
  preset: VideoAgentPreset;
  prototypeResult: VideoAgentPrototypeResult | null;
  settings: VideoAgentSettings;
};

export function VideoAgentPreview({
  confirmation,
  phase,
  preset,
  prototypeResult,
  settings,
}: VideoAgentPreviewProps) {
  return (
    <section className="flex h-[580px] min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-border bg-surface shadow-sm md:h-[640px]">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{VIDEO_AGENT_COPY.preview.header}</h2>
          <p className="text-xs text-text-muted">Test output for the Commercial Video Agent.</p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary">
          {preset.engineLabel}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-7">
        {phase === 'prompt-ready' && prototypeResult ? (
          <VideoAgentPromptPreview result={prototypeResult} />
        ) : (
          <div className="flex aspect-[9/16] h-[520px] max-h-full max-w-full flex-col items-center justify-center rounded-[8px] border border-border bg-surface-2 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-bg text-text-primary shadow-sm">
              <Play className="h-7 w-7 fill-current" />
            </span>
            <p className="mt-5 max-w-[210px] text-sm leading-6 text-text-secondary">
              {phase === 'confirm' && confirmation
                ? VIDEO_AGENT_COPY.preview.preparingTitle
                : VIDEO_AGENT_COPY.preview.emptyTitle}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-text-secondary">
          <span>{VIDEO_AGENT_COPY.preview.statusPrefix}</span>
          <span className="text-text-muted">•</span>
          <span>{preset.engineLabel}</span>
          <span className="text-text-muted">•</span>
          <span>{settings.durationSec}s</span>
          <span className="text-text-muted">•</span>
          <span>{settings.aspectRatio}</span>
          <span className="text-text-muted">•</span>
          <span>{VIDEO_AGENT_COPY.preview.reservedNote}</span>
        </div>
        {phase !== 'prompt-ready' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-surface-2 px-3 text-sm text-text-muted" disabled>
              <RefreshCcw className="h-4 w-4" />
              {VIDEO_AGENT_COPY.preview.actions.regenerate}
            </button>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-surface-2 px-3 text-sm text-text-muted" disabled>
              <Sparkles className="h-4 w-4" />
              {VIDEO_AGENT_COPY.preview.actions.premium}
            </button>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-surface-2 px-3 text-sm text-text-muted" disabled>
              <Download className="h-4 w-4" />
              {VIDEO_AGENT_COPY.preview.actions.download}
            </button>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-surface-2 px-3 text-sm text-text-muted" disabled>
              <Bookmark className="h-4 w-4" />
              {VIDEO_AGENT_COPY.preview.actions.save}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
