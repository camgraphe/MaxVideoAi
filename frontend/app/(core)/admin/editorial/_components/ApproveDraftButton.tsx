'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ApproveDraftButton({ articleId, version, digest, disabledReason, publish = false, retryChecks = false, retryPublication = false }: { articleId: string; version: number; digest: string; disabledReason?: string; publish?: boolean; retryChecks?: boolean; retryPublication?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (disabledReason || pending) return;
    if (!window.confirm(retryPublication ? 'Reprendre la publication de cette version ? Le service vérifiera ce qui a déjà été effectué avant de continuer.' : retryChecks ? 'Relancer les contrôles techniques de cette version ? Aucun contenu ne sera régénéré.' : publish ? `Valider et publier la version ${version} en EN, FR et ES sur MaxVideoAI ? La mise en ligne démarrera automatiquement.` : `Valider le contenu de la version ${version} ? Cette validation éditoriale ne publie pas l’article.`)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/editorial/${articleId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, digest, ...(retryPublication ? {intent: 'retry-publication'} : retryChecks ? { intent: 'retry-checks' } : publish ? { intent: 'publish' } : {}) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Approval failed');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approval failed');
    } finally {
      setPending(false);
    }
  }

  return <div className="mt-5"><button type="button" onClick={approve} disabled={pending || Boolean(disabledReason)} className="rounded-full bg-text-primary px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">{pending ? 'Enregistrement…' : retryPublication ? 'Reprendre la publication' : retryChecks ? 'Relancer les contrôles' : publish ? 'Valider et publier' : 'Valider cette version'}</button>{disabledReason && <p className="mt-2 text-sm text-text-secondary">{disabledReason}</p>}{error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}</div>;
}
