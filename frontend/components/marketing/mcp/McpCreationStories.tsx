import type { AppLocale } from '@/i18n/locales';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import { getCreationStoriesCopy } from './creation-stories-copy';

export function McpCreationStories({ locale }: { locale: AppLocale }) {
  const copy = getCreationStoriesCopy(locale);
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return <section id="creative-examples" className="mcp-section mcp-creations">
    <div className="container-page">
      <div className="mcp-section-heading"><div><p className="mcp-eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2></div><p>{copy.intro}</p></div>
      <div className="mcp-creation-grid">{copy.stories.map(story => <article id={story.id} key={story.id} className="mcp-creation-card">
        <figure data-creation-film={story.id}>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            <PublicVideoPlayer src={`/media/mcp/creations/${story.id}-720p.mp4`} poster={`/media/mcp/creations/${story.id}.webp`} deferPoster title={story.title} locale={locale} className="h-full w-full object-contain" />
          </div>
          <figcaption>{story.duration} · {story.id === 'main-character' ? 'Main Character' : story.id === 'the-hat-stays' ? 'The Hat Stays' : 'The Daylight Afterparty'}</figcaption>
        </figure>
        <h3>{story.title}</h3><p>{story.body}</p>
        <details><summary>{copy.details}</summary><p>{story.method}</p>
          {story.id === 'main-character' ? <p>{copy.credit} <a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100474">Kevin MacLeod</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p> : null}
        </details>
      </article>)}</div>
      <a className="mcp-text-link" href={`${prefix}/${locale === 'es' ? 'integraciones' : 'integrations'}/codex`}>{copy.connect} →</a>
    </div>
  </section>;
}

export function McpCreationHostBridge({ locale }: { locale: AppLocale }) {
  const copy = getCreationStoriesCopy(locale);
  return <aside data-creation-host-scope className="mcp-section"><div className="container-page"><p>{copy.bridge}</p><a className="mcp-text-link" href={`${locale === 'en' ? '' : `/${locale}`}/mcp#creative-examples`}>{copy.bridgeLink} →</a></div></aside>;
}
