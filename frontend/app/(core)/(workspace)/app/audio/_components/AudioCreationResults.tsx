'use client';
import type { ReactNode } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import type { AudioCreationIntent } from '@/lib/audio-creation';
import type { AudioJobDetail } from '../_lib/audio-workspace-types';
import type { AudioCreationCopy } from '../_lib/audio-creation-copy';
import styles from './audio-creation.module.css';
export function AudioCreationResults({ copy, result, pending, onReuse, children }: { intent: AudioCreationIntent; copy: AudioCreationCopy; result: AudioJobDetail | null; pending: number; onReuse: () => void; children?: ReactNode }) {
  return <aside className={styles.results} aria-label={copy.listen}>
    <h2>{copy.listen}</h2>
    {pending > 0 ? <div className={styles.status} role="status">{copy.generating}{pending > 1 ? ` (${pending})` : ''}<small>{copy.generatingHint}</small></div> : null}
    {result?.audioUrl || result?.videoUrl ? <article className={styles.player}>
      <strong>{result.engineLabel ?? copy.output}</strong>
      {result.videoUrl ? <video key={result.videoUrl} controls preload="none" src={result.videoUrl} poster={result.thumbUrl ?? undefined} /> : null}
      {result.audioUrl ? <audio key={result.audioUrl} controls preload="none" src={result.audioUrl} aria-label={copy.output} /> : null}
      <div className={styles.playerActions}><a href={result.audioUrl ?? result.videoUrl ?? ''} target="_blank" rel="noreferrer" download aria-label={copy.download} title={copy.download}><Download size={18} aria-hidden /></a>{result.settingsSnapshot ? <button type="button" onClick={onReuse} aria-label={copy.reuse} title={copy.reuse}><RotateCcw size={18} aria-hidden /></button> : null}</div>
      <details className={styles.metadata}><summary>{copy.details}</summary><dl>
        <dt>Job</dt><dd>{result.jobId}</dd>
        {Object.entries(result.settingsSnapshot?.providers ?? {}).flatMap(([role, value]) => value && typeof value === 'object' && 'model' in value && typeof value.model === 'string' ? [<div key={role} className={styles.providerDetail}><dt>{copy.model}</dt><dd>{value.model}</dd></div>] : [])}
        {result.settingsSnapshot?.measuredDurationSec ? <><dt>{copy.measured}</dt><dd>{result.settingsSnapshot.measuredDurationSec.toFixed(2)} s</dd></> : null}
        {result.settingsSnapshot?.requestedDurationSec ? <><dt>{copy.requested}</dt><dd>{result.settingsSnapshot.requestedDurationSec} s</dd></> : null}
      </dl></details>
    </article> : result?.status === 'failed' ? <div className={styles.status} role="alert">{copy.failed}</div> : result?.status === 'running' || result?.status === 'pending' ? <div className={styles.status} role="status">{copy.generating}</div> : <div className={styles.empty}><div className={styles.monitor} aria-hidden><span /></div></div>}
    {children}
  </aside>;
}
