'use client';
import { AppGlyph } from '@/components/app/AppGlyph';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { workspaceReferenceCopy } from './workspace-reference-copy';
export function WorkspaceOptionsButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { locale } = useI18n();
  const label = workspaceReferenceCopy(locale).options;

  return (
    <button
      type="button"
      className="app-options-button"
      aria-label={label}
      title={label}
      aria-expanded={open}
      onClick={onToggle}
    >
      <AppGlyph name="settings" />
    </button>
  );
}
