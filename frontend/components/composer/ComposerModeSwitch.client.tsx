'use client';

import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { WorkspaceComposerGlyph } from './WorkspaceComposerGlyph';
import type { ComposerModeToggle, ComposerProps } from './composer-types';

type Props = Pick<ComposerProps, 'activeManualMode' | 'onModeToggle'> & {
  modes: ComposerModeToggle[];
  workspaceDensity: boolean;
};

export function ComposerModeSwitch({ modes, workspaceDensity, activeManualMode, onModeToggle }: Props) {
  return (
    <div className={clsx('app-mode-switch flex flex-wrap gap-2', workspaceDensity && 'app-mode-switch-segmented')}>
      {modes.map((entry) => {
        const active = activeManualMode === entry.mode;
        return (
          <Button
            key={entry.mode ?? 'base'}
            data-composer-mode={entry.mode ?? 'create'}
            type="button"
            size="sm"
            variant={active ? 'primary' : 'outline'}
            onClick={() => onModeToggle?.(entry.mode === null ? null : active ? null : entry.mode)}
            disabled={entry.disabled}
            title={entry.disabledReason}
            aria-pressed={active}
            className="!min-h-11 rounded-2xl px-4 py-0 text-[12px] font-semibold dark:border-white/12 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
          >
            {workspaceDensity ? <WorkspaceComposerGlyph name={entry.mode === null ? 'create' : entry.mode === 'extend' ? 'extend' : 'modify'} /> : null}
            <span>{entry.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
