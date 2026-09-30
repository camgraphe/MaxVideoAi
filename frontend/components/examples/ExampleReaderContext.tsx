import { WatchKeyFrames } from '@/components/watch/WatchKeyFrames';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';
import { ExampleReaderDisclosure } from './ExampleReaderDisclosure.client';
import styles from './example-reader-styles';

/** The same lightweight editorial disclosure is server-rendered on the watch URL. */
export function ExampleReaderContext({ context, detail, locale }: { context: ExampleWatchDetail['context']; detail: ExampleWatchDetail; locale: string }) {
  const fr = locale === 'fr', es = locale === 'es';
  const date = context.createdAt && Number.isFinite(Date.parse(context.createdAt)) ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(context.createdAt)) : null;
  const highlights = context.highlights.filter(text => text.trim());
  const notes = context.notes.filter(text => text.trim());
  const engineBadges = context.engineBadges.filter(text => text.trim());
  const settings = [...context.details, ...context.controls].filter(row => row.label.trim() && row.value.trim());
  const compareLinks = context.compareLinks.filter(link => link.href.trim() && link.label.trim());
  const hasModelContext = Boolean(context.engineDescription.trim() || engineBadges.length);
  const hasGuidance = Boolean(context.visualContext?.trim() || highlights.length || notes.length || context.negativePrompt?.trim());
  const hasRenderContext = Boolean(settings.length || date || hasModelContext || compareLinks.length);
  const hasKeyframes = Boolean(context.keyframes && Object.values(context.keyframes).some(url => url?.trim()));
  const hasDisclosure = hasGuidance || hasRenderContext || hasKeyframes;
  if (!context.intro.trim() && !hasDisclosure) return null;
  return <section className={styles.context}>
    {context.intro.trim() && <p>{context.intro}</p>}
    {hasDisclosure && <ExampleReaderDisclosure label={fr ? 'Détails et conseils' : es ? 'Detalles y consejos' : 'Video details & tips'}>
      {(hasGuidance || hasRenderContext) && <div className={styles.contextGrid}>
        {hasGuidance && <section>
          {context.visualContext?.trim() && <><h3>{fr ? 'Contexte visuel' : es ? 'Contexto visual' : 'Visual workflow context'}</h3><p>{context.visualContext}</p></>}
          {highlights.length > 0 && <>
            <h3>{fr ? 'Ce que montre cet exemple' : es ? 'Qué muestra este ejemplo' : 'What this example shows'}</h3>
            <ul>{highlights.map(text => <li key={text}>{text}</li>)}</ul>
          </>}
          {notes.length > 0 && <><h3>{fr ? 'Pour améliorer le prompt' : es ? 'Consejos para el prompt' : 'Prompt improvement notes'}</h3><ul>{notes.map(text => <li key={text}>{text}</li>)}</ul></>}
          {context.negativePrompt?.trim() && <><h3>Negative prompt</h3><p>{context.negativePrompt}</p></>}
        </section>}
        {hasRenderContext && <section>
          {settings.length > 0 && <>
            <h3>{fr ? 'Réglages du rendu original' : es ? 'Ajustes del vídeo original' : 'Original render settings'}</h3>
            <dl>{settings.map((row,index) => <div key={`${row.key}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
          </>}
          {date && <p><time dateTime={context.createdAt}>{date}</time></p>}
          {hasModelContext && <>
            <h3>{detail.engineLabel}</h3>
            {context.engineDescription.trim() && <p>{context.engineDescription}</p>}
            {engineBadges.length > 0 && <ul>{engineBadges.map(text => <li key={text}>{text}</li>)}</ul>}
          </>}
          {compareLinks.length > 0 && <><h3>{fr ? 'Comparer ce modèle' : es ? 'Comparar este modelo' : 'Compare this model'}</h3><ul>{compareLinks.map(link => <li key={link.href}><a href={link.href}>{link.label}</a>{link.reason.trim() && <p>{link.reason}</p>}</li>)}</ul></>}
        </section>}
      </div>}
      {hasKeyframes && <section><h3>{fr ? 'Images clés' : es ? 'Fotogramas clave' : 'Key frames'}</h3><WatchKeyFrames videoUrl={detail.videoUrl} posterUrl={detail.posterUrl ?? ''} title={detail.title} durationSec={detail.durationSec} keyframeUrls={context.keyframes}/></section>}
    </ExampleReaderDisclosure>}
  </section>;
}
