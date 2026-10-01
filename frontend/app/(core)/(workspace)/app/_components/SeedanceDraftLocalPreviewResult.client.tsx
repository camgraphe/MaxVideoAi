'use client';

import { Button } from '@/components/ui/Button';
import type { useSeedanceDraftLocalPreview } from '../_hooks/useSeedanceDraftLocalPreview';

export function SeedanceDraftLocalPreviewResult({ preview }: { preview: ReturnType<typeof useSeedanceDraftLocalPreview> }) {
  if (!preview.available || !preview.selected || preview.phase === 'setup') return null;
  const reference = preview.finalQuote?.status === 'exact'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: preview.finalQuote.currency }).format(preview.finalQuote.amountCents / 100)
    : null;
  return (
    <section aria-label="Aperçu du résultat Draft" className="rounded-card border border-brand/40 bg-surface px-4 py-3 text-sm" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-text-primary">{preview.phase === 'final' ? 'Final 1080p · simulation terminée' : 'Draft 480p · résultat simulé'}</p>
          <p className="mt-1 text-xs text-text-muted">{preview.snapshot?.durationSec} s · {preview.snapshot?.aspectRatio} · {preview.snapshot?.audio ? 'Audio activé' : 'Sans audio'} · Seedance 2.5</p>
        </div>
        {preview.phase === 'draft' ? <Button size="sm" onClick={() => void preview.requestFinal()}>Finaliser en 1080p</Button> : null}
        {preview.phase === 'final' ? <Button size="sm" variant="outline" onClick={preview.cancel}>Revenir au Draft</Button> : null}
      </div>
      {preview.phase === 'draft' ? <p className="mt-2 text-xs text-text-secondary">Le Draft reste disponible. Le final est optionnel, avec un devis et un paiement séparés.</p> : null}
      {preview.phase === 'confirm' ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="font-medium">Finaliser ce Draft en 1080p</p>
          <p className="mt-1 text-xs text-text-secondary">Même prompt et mêmes entrées créatives. Nouveau rendu, facturé séparément.</p>
          <p className="mt-2 text-sm text-text-primary">{preview.pending ? 'Lecture du registre de prix…' : reference ? `Référence actuelle 1080p : ${reference}` : preview.error}</p>
          <p className="mt-1 text-xs text-text-muted">Tarif classique provenant du registre. Son utilisation pour le final Draft reste à valider.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={!reference || preview.pending} onClick={preview.confirmSimulation}>Simuler la confirmation</Button>
            <Button size="sm" variant="outline" onClick={preview.cancel}>Annuler</Button>
          </div>
        </div>
      ) : null}
      {preview.phase === 'final' ? <p className="mt-2 text-xs text-text-secondary">Deux rendus liés et deux reçus distincts dans le parcours final. Aucun job ni reçu n’est créé par cet aperçu.</p> : null}
    </section>
  );
}
