'use client';

import {
  Clock3,
  Monitor,
  Smartphone,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  VIDEO_AGENT_ASPECT_RATIO_OPTIONS,
  VIDEO_AGENT_DURATION_OPTIONS,
  VIDEO_AGENT_RESOLUTION_OPTIONS,
  formatVideoAgentPrice,
  type VideoAgentAspectRatio,
  type VideoAgentPreset,
  type VideoAgentResolution,
  type VideoAgentSettings,
} from '../_lib/video-agent-config';
import { VIDEO_AGENT_COPY } from '../_lib/video-agent-copy';

type VideoAgentSettingsStripProps = {
  estimatedPriceCents: number;
  preset: VideoAgentPreset;
  settings: VideoAgentSettings;
  onAspectRatioChange: (value: VideoAgentAspectRatio) => void;
  onDurationChange: (value: VideoAgentSettings['durationSec']) => void;
  onResolutionChange: (value: VideoAgentResolution) => void;
  onToggleAudio: () => void;
};

function optionClass(active: boolean) {
  return [
    'inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-3 text-sm transition',
    active
      ? 'bg-text-primary text-bg shadow-sm'
      : 'border border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary',
  ].join(' ');
}

function AspectIcon({ value }: { value: VideoAgentAspectRatio }) {
  if (value === '9:16') return <Smartphone className="h-4 w-4" />;
  if (value === '16:9') return <Monitor className="h-4 w-4" />;
  return <Square className="h-4 w-4" />;
}

export function VideoAgentSettingsStrip({
  estimatedPriceCents,
  preset,
  settings,
  onAspectRatioChange,
  onDurationChange,
  onResolutionChange,
  onToggleAudio,
}: VideoAgentSettingsStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-border bg-surface px-3 py-3 shadow-sm">
      <div className="flex items-center gap-2 rounded-[8px] border border-border bg-bg px-3 py-2">
        <span className="text-xs text-text-muted">{VIDEO_AGENT_COPY.settings.modelLabel}</span>
        <span className="text-sm font-semibold text-text-primary">{preset.engineLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-text-muted" />
        {VIDEO_AGENT_DURATION_OPTIONS.map((duration) => (
          <button
            key={duration}
            type="button"
            className={optionClass(settings.durationSec === duration)}
            onClick={() => onDurationChange(duration)}
          >
            {duration}s
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {VIDEO_AGENT_ASPECT_RATIO_OPTIONS.map((ratio) => (
          <button
            key={ratio}
            type="button"
            className={optionClass(settings.aspectRatio === ratio)}
            onClick={() => onAspectRatioChange(ratio)}
          >
            <AspectIcon value={ratio} />
            {ratio}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {VIDEO_AGENT_RESOLUTION_OPTIONS.map((resolution) => (
          <button
            key={resolution}
            type="button"
            className={optionClass(settings.resolution === resolution)}
            onClick={() => onResolutionChange(resolution)}
          >
            {resolution}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={optionClass(settings.audioEnabled)}
        onClick={onToggleAudio}
        aria-pressed={settings.audioEnabled}
      >
        {settings.audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        {VIDEO_AGENT_COPY.settings.audioLabel}
      </button>

      <div className="ml-auto flex min-w-[92px] flex-col rounded-[8px] border border-border bg-bg px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
          {VIDEO_AGENT_COPY.settings.estimateLabel}
        </span>
        <span className="text-base font-semibold text-text-primary">
          {formatVideoAgentPrice(estimatedPriceCents)}
        </span>
      </div>
    </div>
  );
}
