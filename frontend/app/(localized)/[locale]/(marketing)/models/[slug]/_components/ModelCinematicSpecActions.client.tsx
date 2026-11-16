'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { copyTextToClipboard } from '@/lib/clipboard';
import { buildCinematicSpecExports, cinematicSpecCopy, type CinematicSpecRow } from '../_lib/model-page-cinematic-specs';

export function ModelCinematicSpecActions({ title, rows, source, locale, slug, reviewedAt }: { reviewedAt?: string; title: string; rows: CinematicSpecRow[]; source: string; locale: AppLocale; slug: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  const copy = cinematicSpecCopy[locale];
  const exportData = () => buildCinematicSpecExports({ title, rows, source, locale, reviewedAt });
  async function copyTable() {
    const data = exportData();
    // Embedded browsers can accept rich clipboard writes without forwarding them
    // to the host. Write the usable Markdown version before enhancing it to HTML.
    let success = await copyTextToClipboard(data.text);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([data.html], { type: 'text/html' }), 'text/plain': new Blob([data.text], { type: 'text/plain' }) })]);
        success = true;
      }
    } catch { /* Keep the plain-text version when rich clipboard access is unavailable. */ }
    setStatus(success ? 'copied' : 'failed');
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setStatus('idle'), 4000);
  }
  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([exportData().csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${slug}-specifications-${locale}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="cinema-spec-actions">
    <button type="button" onClick={() => void copyTable()} data-analytics-event="cta_click" data-analytics-cta-name="copy_specs" data-analytics-cta-location="model_specs"><Copy size={15} aria-hidden="true" />{status === 'copied' ? copy.copied : copy.copy}</button>
    <button type="button" onClick={downloadCsv} data-analytics-event="cta_click" data-analytics-cta-name="download_specs" data-analytics-cta-location="model_specs"><Download size={15} aria-hidden="true" />{copy.csv}</button>
    <span className={status === 'failed' ? 'cinema-export-error' : 'sr-only'} role="status">{status === 'failed' ? copy.failed : status === 'copied' ? copy.copied : ''}</span>
  </div>;
}
