'use client';
import type {AgentGenerationResult} from '@/server/generations/generation-status';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import styles from '../image-conversation.module.css';

export function ConversationMedia({result, locale}: {result: AgentGenerationResult; locale: ConversationLocale}) {
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  const open = (url: string) => <a href={url} target="_blank" rel="noopener noreferrer">{t('Open original', 'Ouvrir l’original')}</a>;
  return <div className={styles.results}>
    {result.surface === 'image' ? result.imageUrls.map((url, index) => <figure key={url}>
      <img src={result.thumbnailUrls[index] ?? url} alt={t('Your creation', 'Votre création')} loading="lazy" />
      <figcaption><span>{t('Your image', 'Votre image')}</span>{open(url)}</figcaption>
    </figure>) : result.surface === 'video' ? <figure>
      <video src={result.videoUrl} poster={result.thumbnailUrl ?? undefined} controls playsInline preload="none" aria-label={t('Generated video', 'Vidéo créée')} />
      <figcaption><span>{t('Your video', 'Votre vidéo')}</span>{open(result.videoUrl)}</figcaption>
    </figure> : <>
      {result.audioUrl && <figure>
        <audio src={result.audioUrl} controls preload="none" aria-label={t('Generated audio', 'Audio créé')} />
        <figcaption><span>Audio{result.durationSec !== null ? ` · ${result.durationSec} s` : ''}</span>{open(result.audioUrl)}</figcaption>
      </figure>}
      {result.videoUrl && <figure><video src={result.videoUrl} poster={result.thumbnailUrl ?? undefined} controls playsInline preload="none" aria-label={t('Generated video', 'Vidéo créée')} /><figcaption>{open(result.videoUrl)}</figcaption></figure>}
    </>}
  </div>;
}
