'use client';

import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function WorkspaceCreationHeading({ media = 'video', action }: { media?: 'video' | 'image'; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <h1 className="sr-only">{media === 'image' ? t('workspace.header.createImage', 'Create image') : t('workspace.header.createVideo', 'Create video')}</h1>
      {action ? <div className="app-creation-heading flex items-center justify-end gap-3 md:hidden">{action}</div> : null}
    </>
  );
}
