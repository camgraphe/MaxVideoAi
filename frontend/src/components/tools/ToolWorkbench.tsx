'use client';
import type { ReactNode, ChangeEventHandler } from 'react';
import Link from 'next/link';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { ToolboxScene } from './ToolboxScene';
import { toolboxCopy, type ToolboxVisualId } from './toolbox-copy';
import styles from './tool-workbench.module.css';

/** Presentation slots keep existing service/quote/media controllers reusable in Studio. */
export function ToolWorkbench({ locale, visual, source, settings, preview, recent, children, embedded = false }: { locale: string; visual: ToolboxVisualId; source: ReactNode; settings?: ReactNode; preview: ReactNode; recent?: ReactNode; children?: ReactNode; embedded?: boolean }) {
  const copy = toolboxCopy(locale);
  const body = <div className={styles.workbench}>
    <header className={styles.header}><Link href="/app/tools" prefetch={false}>← {copy.back}</Link><div><h1>{copy.tools[visual].title}</h1></div></header>
    {children}
    <div className={styles.layout}><aside className={styles.rail}>{source}{settings}</aside><section className={styles.stage}>{preview}</section></div>
    {recent ? <section className={styles.recent}>{recent}</section> : null}
  </div>;
  if (embedded) return body;
  return <div className="flex min-h-screen flex-col bg-bg"><HeaderBar /><div className="flex min-w-0 flex-1 flex-col md:flex-row"><AppSidebar /><main className="app-scroll-surface min-w-0 flex-1 overflow-y-auto">{body}</main></div></div>;
}
export function ToolEmptyPreview({ locale, visual }: { locale: string; visual: ToolboxVisualId }) {
  const copy = toolboxCopy(locale);
  return <div className={styles.emptyPreview}><div className={styles.scene}><ToolboxScene kind={visual} /><span>{copy.illustration}</span></div></div>;
}
export function ToolSourceInput({ locale, kind, onKindChange, url, name, disabled, uploading, onUpload, onLibrary, onUrlChange }: { locale: string; kind: 'image' | 'video'; onKindChange?: (kind: 'image' | 'video') => void; url: string; name?: string | null; disabled?: boolean; uploading?: boolean; onUpload: ChangeEventHandler<HTMLInputElement>; onLibrary: () => void; onUrlChange: (url: string) => void }) {
  const copy = toolboxCopy(locale);
  return <section className={styles.source}><div className={styles.sourceHeading}><h2 className="sr-only">{copy.source}</h2>{onKindChange ? <div className={styles.segments}>{(['image', 'video'] as const).map(value => <button key={value} type="button" aria-pressed={kind === value} onClick={() => onKindChange(value)} disabled={disabled || uploading}>{copy[value]}</button>)}</div> : <span>{copy[kind]}</span>}</div>
    <div className={styles.sourceActions}><label className={styles.upload} aria-disabled={disabled || uploading}><input aria-label={copy.import} type="file" accept={`${kind}/*`} disabled={disabled || uploading} onChange={onUpload} /><span aria-hidden="true">↥</span><strong>{uploading ? '…' : copy.import}</strong></label>
    <button type="button" className={styles.library} onClick={onLibrary} disabled={disabled || uploading}><span aria-hidden="true">▦</span>{copy.library}</button></div>
    {name ? <p className={styles.sourceName} title={name}>{name}</p> : null}
    <details className={styles.url}><summary>{copy.url}</summary><label><span className="sr-only">{copy.url}</span><input type="url" value={url} onChange={event => onUrlChange(event.target.value)} disabled={disabled || uploading} placeholder="https://…" /></label></details>
  </section>;
}
export function ToolProcessing({ locale }: { locale: string }) { const copy = toolboxCopy(locale); return <div role="status" className={styles.processing}><span aria-hidden="true">◌</span><div><strong>{copy.processing}</strong></div></div>; }

export function ToolAuthNotice({ locale, path }: { locale: string; path: string }) { return <Link className="mb-4 inline-flex min-h-11 items-center text-sm underline" href={buildLoginHref({ mode: 'signin', nextPath: path })}>{toolboxCopy(locale).signIn}</Link>; }
