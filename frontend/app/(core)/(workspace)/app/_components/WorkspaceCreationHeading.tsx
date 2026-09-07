'use client';

import { Clapperboard, Image as ImageIcon, LibraryBig } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function WorkspaceCreationHeading({ media = 'video' }: { media?: 'video' | 'image' }) {
  const { t } = useI18n();
  return (
      <div className="app-creation-heading flex items-center justify-between gap-3">
        <div>
          <span className="app-eyebrow">{media === 'image' ? <ImageIcon size={16} aria-hidden /> : <Clapperboard size={16} aria-hidden />}{t('workspace.header.workspaceLabel', 'Creative workspace')}</span>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">{media === 'image' ? t('workspace.header.createImage', 'Create image') : t('workspace.header.createVideo', 'Create video')}</h1>
        </div>
        <ButtonLink href={`/app/library?kind=${media}`} prefetch={false} variant="outline" size="sm" className="!min-h-11 gap-2 rounded-full">
          <LibraryBig className="h-4 w-4" aria-hidden />
          {t('workspace.header.quickNav.library', 'Library')}
        </ButtonLink>
      </div>
  );
}
