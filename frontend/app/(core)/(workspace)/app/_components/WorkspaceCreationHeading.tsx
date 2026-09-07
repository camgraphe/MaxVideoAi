'use client';

import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function WorkspaceCreationHeading({ media = 'video', action }: { media?: 'video' | 'image'; action?: ReactNode }) {
  const { t } = useI18n();
  return (
      <div className="app-creation-heading flex items-center justify-between gap-3">
        <div>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">{media === 'image' ? t('workspace.header.createImage', 'Create image') : t('workspace.header.createVideo', 'Create video')}</h1>
        </div>
        {action}
      </div>
  );
}
