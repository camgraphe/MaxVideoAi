'use client';

import { useState } from 'react';
import { Download, Link2, Code2, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { ComparisonCopy } from '../_content/types';
import styles from './comparison.module.css';

export function ShareComparison({ copy, locale, canonical }: { copy: ComparisonCopy['share']; locale: AppLocale; canonical: string }) {
  const [status, setStatus] = useState('');
  const [fallback, setFallback] = useState('');
  const download = `/higgsfield-alternative/comparison?format=png&locale=${locale}`;
  const source = `${canonical}#comparison`;
  const embed = `<figure><a href="${source}"><img src="https://maxvideoai.com${download.replaceAll('&', '&amp;')}" alt="MaxVideoAI vs Higgsfield — 2026-11-10" width="1200" loading="lazy" style="max-width:100%;height:auto"></a><figcaption><a href="${source}">${copy.attribution}</a> · 2026-11-10</figcaption></figure>`;
  async function copyText(value: string, success: string) {
    try { await navigator.clipboard.writeText(value); setFallback(''); setStatus(success); }
    catch { setFallback(value); setStatus(copy.copyFailed); }
  }
  return (
    <section className={styles.share} id="share" aria-labelledby="share-title">
      <div><h2 id="share-title">{copy.title}</h2><p>{copy.description}</p></div>
      <div className={styles.shareActions}>
        <a className={styles.outlineButton} href={download} download={`maxvideoai-higgsfield-${locale}-2026-11-10.png`} data-analytics-event="cta_click" data-analytics-cta-name="higgsfield_download_comparison" data-analytics-cta-location="comparison_share"><Download size={18} aria-hidden="true" />{copy.download}</a>
        <button className={styles.outlineButton} type="button" onClick={() => copyText(source, copy.copied)}><Link2 size={18} aria-hidden="true" />{copy.copy}</button>
      </div>
      <div className={styles.shareLinks}>
        <a href={`/higgsfield-alternative/comparison?format=csv&locale=${locale}`} download>{copy.csv}<ArrowUpRight size={16} aria-hidden="true" /></a>
        <a href={`/higgsfield-alternative/comparison?format=json&locale=${locale}`}>{copy.json}<ArrowUpRight size={16} aria-hidden="true" /></a>
        <button type="button" onClick={() => { setFallback(embed); setStatus(''); }}><Code2 size={16} aria-hidden="true" />{copy.embed}</button>
      </div>
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
      {fallback ? <div className={styles.embed}><textarea aria-label={fallback === source ? copy.copy : copy.embed} readOnly value={fallback} onFocus={(event) => event.target.select()} /><button type="button" className={styles.outlineButton} onClick={() => copyText(fallback, fallback === source ? copy.copied : copy.embedCopied)}>{fallback === source ? copy.copy : copy.copyEmbed}</button></div> : null}
      <p className={styles.reuse}>{copy.reuse}</p>
    </section>
  );
}
