'use client';
import type {TimelineExportJobResponse} from '@/server/timeline-exports/contracts';
import styles from '../image-conversation.module.css';
import {ConversationMedia} from './ConversationMedia.client';
export function ConversationRenderCards({jobs,locale}: {jobs: TimelineExportJobResponse[];locale: 'en'|'fr'}) {
  const t = (en: string,fr: string) => locale === 'fr' ? fr : en;
  return <>{jobs.slice(0,4).map(job => <article className={styles.turn} key={job.id} aria-label={t('Film render','Rendu du film')}>
    {job.artifact ? <><p>{t('Your film is ready.','Votre film est prêt.')}</p><ConversationMedia result={{surface: 'video',videoUrl: job.artifact.outputUrl,previewUrl: null,thumbnailUrl: null,audioUrl: null}} locale={locale}/></>
      : <p role="status">{job.status === 'failed' || job.status === 'canceled' ? t('This render did not finish.','Ce rendu n’a pas abouti.') : t('Rendering your film','Le film se prépare')+' · '+job.progress+'%'}</p>}
  </article>)}</>;
}
