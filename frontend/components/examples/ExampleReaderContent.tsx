'use client';

import { useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Volume2, VolumeX, X } from 'lucide-react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { copyTextToClipboard } from '@/lib/clipboard';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';
import { VideoWatchShare } from '@/components/examples/VideoWatchShare.client';
import { DiscoveryVideoPlayer, type ReaderNavigation } from './DiscoveryVideoPlayer.client';
import type { ReaderCopy } from './example-reader-copy';
import styles from './example-reader-styles';
import { ExampleReaderContext } from './ExampleReaderContext';

type Props = { detail: ExampleWatchDetail; copy: ReaderCopy; locale: string; navigation?: ReaderNavigation; onClose?: () => void; headingLevel?: 'h1' | 'h2' };

export function ExampleReaderContent({ detail, copy, locale, navigation, onClose, headingLevel = 'h2' }: Props) {
  const Heading = headingLevel;
  const SectionHeading = headingLevel === 'h1' ? 'h2' : 'h3';
  const QuoteHeading = headingLevel === 'h1' ? 'h3' : 'h4';
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const price = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100); }
    catch { return `${(amount / 100).toFixed(2)} ${currency}`; }
  };
  const copyPrompt = async (button: HTMLButtonElement) => {
    const copied = await copyTextToClipboard(detail.prompt);
    if (button.isConnected) button.focus({ preventScroll: true });
    setCopyStatus(copied ? 'copied' : 'error');
  };
  const [width, height] = detail.aspectRatio.split(':').map(Number);
  const portrait = width / height < 1;
  const originalModel = detail.quotes.find(quote => quote.original);
  const comparisonNote = !detail.scenario ? copy.proposedNote : detail.quotes.some(quote => quote.changed.length > 0) ? copy.compareNote : null;

  return <>
    {navigation && <nav className={styles.playerNavigation} aria-label={copy.reader}>
      <span>{copy.reader}</span>
      <div>
        <button type="button" onClick={navigation.previous} disabled={!navigation.canPrevious || navigation.busy} aria-label={copy.previous}><ChevronLeft size={17}/><span>{copy.previousShort}</span></button>
        <button type="button" onClick={navigation.next} disabled={!navigation.canNext || navigation.busy} aria-label={copy.next}><span>{copy.nextShort}</span><ChevronRight size={17}/></button>
        {onClose && <button type="button" onClick={onClose} aria-label={copy.close} data-modal-initial-focus="true"><X size={18}/></button>}
      </div>
    </nav>}
    <div className={`${styles.layout} ${portrait ? styles.portrait : ''}`}>
      <div className={styles.media}>
        <DiscoveryVideoPlayer detail={detail} copy={copy}/>
        <header className={styles.heading}>
          <Heading id="example-reader-title">{detail.title}</Heading>
          <div className={styles.renderDetails}>
            <p className={styles.meta} aria-label={copy.originalSettings}>
              <span>{detail.durationSec} s</span><span>{detail.scenario?.aspectRatio ?? detail.aspectRatio}</span>
              {detail.scenario && <span>{detail.scenario.resolution}</span>}
              <span>{detail.hasAudio ? <Volume2 size={14}/> : <VolumeX size={14}/>} {detail.hasAudio ? copy.audio : copy.silent}</span>
            </p>
            {originalModel && <p className={styles.recorded}>
              <span>{copy.currentPrice} · {copy.priceBasis}</span><strong>{price(originalModel.amountCents, originalModel.currency)}</strong>
              <span>{originalModel.settings.durationSec} s · {originalModel.settings.resolution} · {originalModel.settings.aspectRatio} · {originalModel.settings.audio ? copy.audio : copy.silent}</span>
              {(!detail.scenario || originalModel.changed.length > 0) && <span>{!detail.scenario ? copy.proposed : copy.adjusted}</span>}
            </p>}
          </div>
        </header>
      </div>
      <aside className={styles.editorial} aria-label={copy.tools}>
        <section className={styles.action}>
          <div className={styles.modelIdentity}>
            <div data-theme="dark" aria-hidden="true"><EngineIcon engine={{ id: originalModel?.engineId ?? detail.modelHref?.split('/').pop() ?? '', label: detail.engineLabel, brandId: originalModel?.brandId }} size={42}/></div>
            <div><p className={styles.model}>{detail.engineLabel}</p>
              {detail.modelHref && <a className={styles.modelLink} href={detail.modelHref}>{copy.model}<ArrowUpRight size={14}/></a>}
            </div>
          </div>
          {detail.recreateHref && <a className={styles.primary} href={detail.recreateHref} data-analytics-event="cta_click" data-analytics-cta-name="reuse_example" data-analytics-cta-location="example_reader">{copy.create}<ArrowUpRight size={17}/></a>}
        </section>
        <section className={styles.prompt} aria-labelledby="example-reader-prompt-title">
          <div className={styles.promptHeading}><SectionHeading id="example-reader-prompt-title">{copy.prompt}</SectionHeading>
            <button type="button" className={styles.copyButton} onClick={event => void copyPrompt(event.currentTarget)}>
              {copyStatus === 'copied' ? <Check size={15}/> : <Copy size={15}/>} {copyStatus === 'copied' ? copy.copied : copy.copy}
            </button>
          </div>
          <p id="example-reader-prompt" className={expanded ? styles.promptExpanded : styles.promptText}>{detail.prompt}</p>
          <button type="button" className={styles.expand} onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="example-reader-prompt">{expanded ? copy.collapse : copy.expand}<ChevronDown size={14}/></button>
          <p role="status" className={copyStatus === 'error' ? styles.copyStatus : 'sr-only'}>{copyStatus === 'copied' ? copy.copied : copyStatus === 'error' ? copy.copyError : ''}</p>
          {copyStatus === 'error' && <textarea className={styles.copyFallback} aria-label={copy.manualCopy} value={detail.prompt} readOnly onFocus={event => event.currentTarget.select()}/>}
        </section>
        {detail.references.length > 0 && <section className={styles.references}><SectionHeading>{copy.sources}</SectionHeading><div>{detail.references.map(reference => <a href={reference.url} target="_blank" rel="noopener noreferrer" key={reference.key} aria-label={reference.label}>
          {/* Approved stable public inputs only, matching the standalone watch-page gate. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reference.thumbUrl ?? reference.url} alt={reference.alt} loading="lazy" width={96} height={96}/>
        </a>)}</div></section>}
        <VideoWatchShare watchUrl={new URL(detail.watchHref, SITE_ORIGIN).toString()} locale={locale}/>
      </aside>
      <section className={styles.comparison} aria-labelledby="example-reader-comparison-title">
        <div className={styles.comparisonHeading}>
          <SectionHeading id="example-reader-comparison-title">{copy.compare}</SectionHeading>
          {detail.quotes.length > 0 && <>
            <p className={styles.note}>{copy.comparisonIntro}</p>
            {comparisonNote && <p className={styles.comparisonNote}>{comparisonNote}</p>}
          </>}
        </div>
        {detail.quotes.length ? <div className={styles.quotes}>{detail.quotes.map(quote => <article key={quote.engineId} className={styles.quote} data-original={quote.original || undefined}>
          <div className={styles.quoteInfo}>
            <div className={styles.quoteIdentity}>
              <div data-theme="dark" aria-hidden="true"><EngineIcon engine={{ id: quote.engineId, label: quote.label, brandId: quote.brandId }} size={38}/></div>
              <div><QuoteHeading>{quote.label}</QuoteHeading>{quote.original && <p className={styles.current}>{copy.current}</p>}</div>
            </div>
            <p className={styles.quoteSettings}>{([
              ['durationSec', `${quote.settings.durationSec} s`], ['resolution', quote.settings.resolution],
              ['aspectRatio', quote.settings.aspectRatio], ['audio', quote.settings.audio ? copy.audio : copy.silent],
            ] as const).map(([key, label]) => <span key={key} data-adjusted={quote.changed.includes(key) || undefined}>{label}</span>)}</p>
            <p className={styles.settingsStatus} data-adjusted={quote.changed.length > 0 || undefined}>{!detail.scenario ? copy.proposed : quote.changed.length ? copy.adjusted : copy.identical}</p>
          </div>
          <div className={styles.quotePrice}><strong className={styles.price}>{price(quote.amountCents, quote.currency)}</strong><span>{copy.estimate}</span></div>
          <a className={styles.quoteCta} href={quote.href} aria-label={`${copy.use} · ${quote.label}`} data-analytics-event="cta_click" data-analytics-cta-name="compare_example_model" data-analytics-cta-location="example_reader"><span className={styles.ctaFull}>{copy.use}</span><span className={styles.ctaCompact}>{copy.useShort}</span><ArrowUpRight size={15}/></a>
        </article>)}</div> : <p className={styles.note}>{copy.unavailable}</p>}
        {detail.quotes.length > 0 && <p className={styles.footnote}>{copy.textOnly} {copy.priceNote}</p>}
      </section>
    </div>
    <ExampleReaderContext context={detail.context} detail={detail} locale={locale}/>
  </>;
}
