import React from 'react';
import { Download } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { CreatorResultImage } from './CreatorResultMedia';
import { CreatorResultVideo } from './CreatorResultVideo.client';
import { creatorResultCopy } from './creator-result-copy';
import media from './creator-results.json';

type ResultTool = 'product-photo-editor' | 'product-video-editor' | 'motion-transfer';

/** Three actual input/output stories, each shown once in its own composition. */
export function CreatorRealResultDemo({ id, locale }: { id: ResultTool; locale: AppLocale }) {
  const copy = creatorResultCopy(locale);
  if (id === 'product-photo-editor') return <div className="creator-photo-result">
    <header className="creator-result-heading"><h2>{copy.photo.title}</h2><p>{copy.photo.intro}</p></header>
    <div className="creator-photo-diptych">
      <figure><CreatorResultImage media={media.photo.source} alt={copy.photo.source} priority /><figcaption>{copy.photo.source}</figcaption></figure>
      <figure><CreatorResultImage media={media.photo.result} alt={copy.photo.result} /><figcaption>{copy.photo.result}</figcaption></figure>
    </div>
    <div className="creator-photo-direction"><blockquote>{copy.photo.instruction}</blockquote><a className="creator-result-download" href={media.photo.result.original} download><Download size={16} aria-hidden="true" />{copy.download}</a></div>
    <p className="creator-result-note">{copy.photo.note}</p>
  </div>;
  if (id === 'product-video-editor') return <div className="creator-video-result">
    <header className="creator-result-heading"><h2>{copy.video.title}</h2><p>{copy.video.intro}</p></header>
    <div className="creator-video-comparison">
      <CreatorResultVideo media={media.video.source} label={copy.video.before} locale={locale} priority />
      <CreatorResultVideo media={media.video.result} label={copy.video.after} locale={locale} />
    </div>
    <div className="creator-result-footer"><p className="creator-result-note">{copy.video.note}</p><a className="creator-result-download" href={media.video.result.original} download><Download size={16} aria-hidden="true" />{copy.download}</a></div>
  </div>;
  return <div className="creator-motion-result">
    <header className="creator-result-heading"><h3>{copy.motion.title}</h3><p>{copy.motion.intro}</p></header>
    <div className="creator-motion-sources">
      <figure className="creator-motion-character"><figcaption>{copy.motion.character}</figcaption><CreatorResultImage media={media.motion.character} alt={copy.motion.character} priority sizes="(max-width: 760px) 75vw, 22vw" /></figure>
      <CreatorResultVideo media={media.motion.reference} label={copy.motion.performance} locale={locale} />
      <div className="creator-motion-generated"><CreatorResultVideo media={media.motion.result} label={copy.motion.result} locale={locale} /></div>
    </div>
    <div className="creator-result-footer"><p className="creator-result-note">{copy.motion.note}</p><a className="creator-result-download" href={media.motion.result.original} download><Download size={16} aria-hidden="true" />{copy.download}</a></div>
    <p className="creator-result-credit">{copy.motion.credit} <a href={media.motion.reference.credit.url} target="_blank" rel="noopener noreferrer">{media.motion.reference.credit.author} · {media.motion.reference.credit.source}</a></p>
  </div>;
}
