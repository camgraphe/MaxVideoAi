'use client';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Copy } from 'lucide-react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';
import { DiscoveryVideoPlayer, type ReaderNavigation } from './DiscoveryVideoPlayer.client';
import type { ReaderCopy } from './example-reader-copy';
import styles from './example-reader-styles';
import { ExampleReaderContext } from './ExampleReaderContext';
import { VideoWatchShare } from '@/app/(core)/video/[id]/_components/VideoWatchShare.client';

export function ExampleReaderContent({ detail, copy, locale, navigation, headingLevel = 'h2' }: { detail: ExampleWatchDetail; copy: ReaderCopy; locale: string; navigation?: ReaderNavigation; headingLevel?: 'h1' | 'h2' }) {
  const Heading = headingLevel;
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const price = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100); }
    catch { return `${(amount / 100).toFixed(2)} ${currency}`; }
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(detail.prompt); setCopyStatus('copied'); }
    catch { setCopyStatus('error'); }
  };
  const [width, height] = detail.aspectRatio.split(':').map(Number);
  const portrait = width / height < 1;
  const action = <section className={styles.action}>
    {detail.historicalCost && <p className={styles.recorded}>{copy.recorded}<strong>{price(detail.historicalCost.amountCents, detail.historicalCost.currency)}</strong></p>}
    {detail.recreateHref && <><a className={styles.primary} href={detail.recreateHref} data-analytics-event="cta_click" data-analytics-cta-name="reuse_example" data-analytics-cta-location="example_reader">{copy.create}<ArrowRight size={18}/></a><p className={styles.note}>{copy.createNote}</p></>}
  </section>;
  return <><div className={`${styles.layout} ${portrait ? styles.portrait : ''}`}>
    <DiscoveryVideoPlayer detail={detail} copy={copy} navigation={navigation}/>
    <aside className={styles.editorial}>
      <div className={styles.heading}>
        {detail.modelHref ? <a href={detail.modelHref} className={styles.model}>{detail.engineLabel}<ArrowUpRight size={15}/></a> : <p className={styles.model}>{detail.engineLabel}</p>}
        <Heading id="example-reader-title">{detail.title}</Heading>
        <p className={styles.meta}>{detail.durationSec} s · {detail.scenario?.aspectRatio ?? detail.aspectRatio}{detail.scenario ? ` · ${detail.scenario.resolution}` : ''} · {detail.hasAudio ? copy.audio : copy.silent}</p>
      </div>
      {!portrait && action}
      <section className={styles.prompt}>
        <div className={styles.promptHeading}><h3>{copy.prompt}</h3><button onClick={() => void copyPrompt()}>{copyStatus === 'copied' ? <Check size={15}/> : <Copy size={15}/>} {copy.copy}</button></div>
        <p className={expanded ? styles.promptExpanded : styles.promptText}>{detail.prompt}</p>
        <button className={styles.expand} onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? copy.collapse : copy.expand}<ChevronDown size={14}/></button>
        <p role="status" className={styles.copyStatus}>{copyStatus === 'copied' ? copy.copied : copyStatus === 'error' ? copy.copyError : ''}</p>
      </section>
      {detail.references.length > 0 && <section className={styles.references}><h3>{copy.sources}</h3><div>{detail.references.map(reference => <a href={reference.url} target="_blank" rel="noreferrer" key={reference.key} aria-label={reference.label}>
        {/* Approved stable public inputs only, matching the standalone watch-page gate. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={reference.thumbUrl ?? reference.url} alt={reference.alt} loading="lazy" width={96} height={96}/>
      </a>)}</div></section>}
      <nav className={styles.links}>
        <VideoWatchShare videoId={detail.id} videoUrl={detail.videoUrl} watchUrl={new URL(detail.watchHref, SITE_ORIGIN).toString()} locale={locale}/>
        {detail.modelHref && <a href={detail.modelHref}><ArrowUpRight size={15}/>{copy.model}</a>}
      </nav>
    </aside>
    {portrait && action}
    <section className={styles.comparison}>
      <h3>{copy.compare}</h3>
      <p className={styles.note}>{copy.textOnly}</p>
      <p className={styles.comparisonNote}>{copy.compareNote}</p>
      {detail.quotes.length ? <div className={styles.quotes}>{detail.quotes.map(quote => <article key={quote.engineId} className={styles.quote}>
        <div><div className={styles.quoteIdentity}><div data-theme="dark" aria-hidden="true"><EngineIcon engine={{ id: quote.engineId, label: quote.label, brandId: quote.brandId }} size={32}/></div><h4>{quote.label}</h4></div>{quote.original && <p className={styles.current}>{copy.current}</p>}
          <p className={styles.quoteSettings}>{([
            ['durationSec', `${quote.settings.durationSec} s`], ['resolution', quote.settings.resolution],
            ['aspectRatio', quote.settings.aspectRatio], ['audio', quote.settings.audio ? copy.audio : copy.silent],
          ] as const).map(([key, label]) => <span key={key} data-adjusted={quote.changed.includes(key) || undefined}>{label}</span>)}</p>
          <p className={styles.current}>{!detail.scenario ? copy.proposed : quote.changed.length ? copy.adjusted : copy.identical}</p>
        </div>
        <strong className={styles.price}>{price(quote.amountCents, quote.currency)}</strong>
        <a href={quote.href} aria-label={`${copy.use} · ${quote.label}`} data-analytics-event="cta_click" data-analytics-cta-name="compare_example_model" data-analytics-cta-location="example_reader">{copy.use}<ArrowRight size={14}/></a>
      </article>)}</div> : <p className={styles.note}>{copy.unavailable}</p>}
      <p className={styles.footnote}>{copy.priceNote}</p>
    </section>
  </div><ExampleReaderContext context={detail.context} detail={detail} locale={locale}/></>;
}
