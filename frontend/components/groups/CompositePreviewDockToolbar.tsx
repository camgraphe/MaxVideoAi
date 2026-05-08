'use client';

import clsx from 'clsx';
import { Download, ExternalLink, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { PreviewCopy } from './composite-preview-dock-utils';
import { ICON_BUTTON_BASE } from './composite-preview-dock-utils';

export function CompositePreviewDockToolbar({
  controls,
  hasGroup,
  isLooping,
  isMuted,
  isPlaying,
  onDownload,
  onOpenModal,
  onToggleLoop,
  onToggleMute,
  onTogglePlay,
  primaryMediaUrl,
}: {
  controls: PreviewCopy['controls'];
  hasGroup: boolean;
  isLooping: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  onDownload: () => void;
  onOpenModal?: () => void;
  onToggleLoop: () => void;
  onToggleMute: () => void;
  onTogglePlay: () => void;
  primaryMediaUrl: string | null;
}) {
  const toolbarItems = [
    {
      key: 'play',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onTogglePlay}
          className={clsx(
            ICON_BUTTON_BASE,
            'p-0',
            isPlaying ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isPlaying ? controls.play.ariaOn : controls.play.ariaOff}
          title={isPlaying ? controls.play.on : controls.play.off}
          aria-pressed={isPlaying}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={isPlaying ? Pause : Play} size={16} />
          </span>
          <span className="sr-only">{isPlaying ? controls.play.on : controls.play.off}</span>
        </Button>
      ),
    },
    {
      key: 'mute',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onToggleMute}
          className={clsx(
            ICON_BUTTON_BASE,
            'p-0',
            isMuted ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isMuted ? controls.mute.ariaOn : controls.mute.ariaOff}
          title={isMuted ? controls.mute.on : controls.mute.off}
          aria-pressed={isMuted}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={isMuted ? VolumeX : Volume2} size={16} />
          </span>
          <span className="sr-only">{isMuted ? controls.mute.on : controls.mute.off}</span>
        </Button>
      ),
    },
    {
      key: 'loop',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onToggleLoop}
          className={clsx(
            ICON_BUTTON_BASE,
            'p-0',
            isLooping ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isLooping ? controls.loop.ariaOn : controls.loop.ariaOff}
          title={isLooping ? controls.loop.on : controls.loop.off}
          aria-pressed={isLooping}
        >
          <span className="relative inline-flex">
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <UIIcon icon={Repeat} size={16} />
            </span>
            {!isLooping ? (
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current"
              />
            ) : null}
          </span>
          <span className="sr-only">{isLooping ? controls.loop.on : controls.loop.off}</span>
        </Button>
      ),
    },
    {
      key: 'download',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDownload}
          disabled={!primaryMediaUrl}
          className={clsx(ICON_BUTTON_BASE, 'p-0 text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
          aria-label={controls.download.aria}
          title={controls.download.label}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={Download} size={16} />
          </span>
          <span className="sr-only">{controls.download.label}</span>
        </Button>
      ),
    },
    {
      key: 'modal',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onOpenModal}
          disabled={!hasGroup || !onOpenModal}
          className={clsx(ICON_BUTTON_BASE, 'p-0 text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
          aria-label={controls.modal.aria}
          title={controls.modal.label}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={ExternalLink} size={16} />
          </span>
          <span className="sr-only">{controls.modal.label}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {toolbarItems.map((item) => (
        <span key={item.key}>{item.element}</span>
      ))}
    </div>
  );
}
