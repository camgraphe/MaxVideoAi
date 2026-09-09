'use client';
import { useState } from 'react';
import { useStudioMediaHandoff } from '../_hooks/useStudioMediaHandoff';
import { resolveWorkspaceMediaSelection } from '../_lib/workspace-media-selection';
import type { WorkspaceLibraryAsset } from '../_lib/workspace-library-assets';
import { useStudioMediaIntent } from '../_hooks/useStudioMediaIntent';
import styles from '../_styles/asset-library.module.css';

export function StudioMediaHandoffReceiver({ accountId, projectId, projectName, onImport, copy }: {
  accountId: string; projectId?: string; projectName: string; onImport: (assets: WorkspaceLibraryAsset[]) => void; copy: Record<string, string>;
}) {
  const { handoff, scope, close } = useStudioMediaHandoff(accountId, projectId);
  const [error, setError] = useState(false);
  const intent = useStudioMediaIntent(scope);
  if (!handoff) return null;
  const cancel = () => { intent.cancel(); close(); };
  const accept = async () => {
    const isCurrent = intent.begin();
    try {
      const assets = await resolveWorkspaceMediaSelection([{ id: `handoff-${crypto.randomUUID()}`, kind: handoff.ref.kind, name: copy.handoffTitle, meta: '', ref: handoff.ref }]);
      if (!isCurrent()) return;
      onImport(assets); close();
    } catch { if (isCurrent()) setError(true); }
  };
  return <div className={styles.assetLibraryOverlay} role="dialog" aria-modal="true" aria-label={copy.handoffTitle}>
    <section className={styles.assetLibraryModal}>
      <h2>{copy.handoffTitle}</h2><p>{projectName} · {copy.title}</p>
      {error ? <p role="alert">{copy.handoffUnavailable}</p> : null}
      <button type="button" onClick={accept}>{copy.importMedia}</button>
      <button type="button" onClick={cancel}>{copy.handoffCancel}</button>
    </section>
  </div>;
}
