'use client';

import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { WorkspaceComposerGlyph } from './WorkspaceComposerGlyph';
import type { ComposerModeToggle, ComposerProps } from './composer-types';
import { useI18n } from '@/lib/i18n/I18nProvider';

type Props = Pick<ComposerProps, 'activeManualMode' | 'onModeToggle'> & {
  modes: ComposerModeToggle[];
  workspaceDensity: boolean;
  compact?: boolean;
};

export function ComposerModeSwitch({ modes, workspaceDensity, activeManualMode, onModeToggle, compact }: Props) {
  const { locale } = useI18n();
  const labels = locale.startsWith('fr') ? ['Créer', 'Modifier', 'Prolonger'] : locale.startsWith('es') ? ['Crear', 'Modificar', 'Extender'] : ['Create', 'Modify', 'Extend'];
  return (
    <div data-compact-modes={compact || undefined} className={clsx('app-mode-switch flex flex-wrap gap-2', workspaceDensity && 'app-mode-switch-segmented')}>
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
            aria-label={entry.label}
            className="!min-h-11 rounded-2xl px-4 py-0 text-[12px] font-semibold dark:border-white/12 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
          >
            {workspaceDensity && !compact ? <WorkspaceComposerGlyph name={entry.mode === null ? 'create' : entry.mode === 'extend' ? 'extend' : 'modify'} /> : null}
            <span>{compact && (entry.mode === null || entry.mode === 'v2v' || entry.mode === 'extend') ? labels[entry.mode === null ? 0 : entry.mode === 'extend' ? 2 : 1] : entry.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
