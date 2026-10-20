'use client';
import React from 'react';
import type { AppLocale } from '@/i18n/locales';
import type { CreatorToolId } from '@/lib/toolbox/creator-availability';
import type { CreatorMarketingLabels } from './creator-copy-types';
import { CreatorLipSyncDemo } from './CreatorLipSyncDemo.client';
import { CreatorRealResultDemo } from './CreatorRealResultDemo';
import { SubtitleResultDemo } from './SubtitleResultDemo.client';

/** Local presentation controls never upload, quote or start a generation. */
export function CreatorWorkflowDemo({ id, labels, locale = 'en' }: { id: CreatorToolId; labels: CreatorMarketingLabels; locale?: AppLocale }) {
  return <figure className="creator-demo" data-tool={id} aria-label={labels.demo}>
    {id === 'subtitles' ? <SubtitleResultDemo locale={locale} /> : id === 'lip-sync' ? <CreatorLipSyncDemo locale={locale} /> : <CreatorRealResultDemo id={id} locale={locale} />}
  </figure>;
}
