'use client';

import clsx from 'clsx';
import { Download, ExternalLink, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { PreviewCopy } from './composite-preview-dock-utils';

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
  compact = false,
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
  compact?: boolean;
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
          disabled={!primaryMediaUrl}
          className={clsx(
            '!min-h-11 rounded-full px-3',
            'gap-2', compact && 'app-preview-toolbar-action',
            isPlaying ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isPlaying ? controls.play.ariaOn : controls.play.ariaOff}
          title={isPlaying ? controls.play.on : controls.play.off}
          aria-pressed={isPlaying}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={isPlaying ? Pause : Play} size={16} />
          </span>
          <span className={clsx('text-xs', compact && 'sr-only')}>{isPlaying ? controls.play.on : controls.play.off}</span>
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
          disabled={!primaryMediaUrl}
          className={clsx(
            '!min-h-11 rounded-full px-3',
            'gap-2', compact && 'app-preview-toolbar-action',
            isMuted ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isMuted ? controls.mute.ariaOn : controls.mute.ariaOff}
          title={isMuted ? controls.mute.on : controls.mute.off}
          aria-pressed={isMuted}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={isMuted ? VolumeX : Volume2} size={16} />
          </span>
          <span className={clsx('text-xs', compact && 'sr-only')}>{isMuted ? controls.mute.on : controls.mute.off}</span>
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
          disabled={!primaryMediaUrl}
          className={clsx(
            '!min-h-11 rounded-full px-3',
            'gap-2', compact && 'app-preview-toolbar-action',
            isLooping ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isLooping ? controls.loop.ariaOn : controls.loop.ariaOff}
          title={isLooping ? controls.loop.on : controls.loop.off}
          aria-pressed={isLooping}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={Repeat} size={16} />
          </span>
          <span className={clsx('text-xs', compact && 'sr-only')}>{isLooping ? controls.loop.on : controls.loop.off}</span>
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
          className={clsx('!min-h-11 gap-2 rounded-full px-3 text-text-secondary hover:text-text-primary', 'disabled:opacity-50', compact && 'app-preview-toolbar-action')}
          aria-label={controls.download.aria}
          title={controls.download.label}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={Download} size={16} />
          </span>
          <span className={clsx('text-xs', compact && 'sr-only')}>{controls.download.label}</span>
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
          className={clsx('!min-h-11 gap-2 rounded-full px-3 text-text-secondary hover:text-text-primary', 'disabled:opacity-50', compact && 'app-preview-toolbar-action')}
          aria-label={controls.modal.aria}
          title={controls.modal.label}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={ExternalLink} size={16} />
          </span>
          <span className={clsx('text-xs', compact && 'sr-only')}>{controls.modal.label}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className={clsx('flex flex-wrap items-center justify-center gap-2', compact && 'app-preview-toolbar-actions')}>
      {toolbarItems.map((item) => (
        <span key={item.key}>{item.element}</span>
      ))}
    </div>
  );
}
