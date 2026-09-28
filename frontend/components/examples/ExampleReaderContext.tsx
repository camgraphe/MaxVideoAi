import { WatchKeyFrames } from '@/components/watch/WatchKeyFrames';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';
import styles from './example-reader.module.css';

/** The same lightweight editorial disclosure is server-rendered on the watch URL. */
export function ExampleReaderContext({ context, detail, locale }: { context: ExampleWatchDetail['context']; detail: ExampleWatchDetail; locale: string }) {
  const fr = locale === 'fr', es = locale === 'es';
  const date = context.createdAt && Number.isFinite(Date.parse(context.createdAt)) ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(context.createdAt)) : null;
  return <section className={styles.context}>
    <p>{context.intro}</p>
    <details>
      <summary>{fr ? 'À propos de cette vidéo' : es ? 'Acerca de este vídeo' : 'About this video'}</summary>
      <div className={styles.contextGrid}>
        <section>
          {context.visualContext && <><h3>{fr ? 'Contexte visuel' : es ? 'Contexto visual' : 'Visual workflow context'}</h3><p>{context.visualContext}</p></>}
          <h3>{fr ? 'Ce que montre cet exemple' : es ? 'Qué muestra este ejemplo' : 'What this example shows'}</h3>
          <ul>{context.highlights.map(text => <li key={text}>{text}</li>)}</ul>
          {context.notes.length > 0 && <><h3>{fr ? 'Pour améliorer le prompt' : es ? 'Consejos para el prompt' : 'Prompt improvement notes'}</h3><ul>{context.notes.map(text => <li key={text}>{text}</li>)}</ul></>}
          {context.negativePrompt && <><h3>Negative prompt</h3><p>{context.negativePrompt}</p></>}
        </section>
        <section>
          <h3>{fr ? 'Réglages du rendu original' : es ? 'Ajustes del vídeo original' : 'Original render settings'}</h3>
          <dl>{[...context.details,...context.controls].map((row,index) => <div key={`${row.key}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
          {date && <p><time dateTime={context.createdAt}>{date}</time></p>}
          <h3>{detail.engineLabel}</h3><p>{context.engineDescription}</p>
          <ul>{context.engineBadges.map(text => <li key={text}>{text}</li>)}</ul>
          {context.compareLinks.length > 0 && <><h3>{fr ? 'Comparer ce modèle' : es ? 'Comparar este modelo' : 'Compare this model'}</h3><ul>{context.compareLinks.map(link => <li key={link.href}><a href={link.href}>{link.label}</a><p>{link.reason}</p></li>)}</ul></>}
        </section>
      </div>
      {context.keyframes && <section><h3>{fr ? 'Images clés' : es ? 'Fotogramas clave' : 'Key frames'}</h3><WatchKeyFrames videoUrl={detail.videoUrl} posterUrl={detail.posterUrl ?? ''} title={detail.title} durationSec={detail.durationSec} keyframeUrls={context.keyframes}/></section>}
    </details>
  </section>;
}
