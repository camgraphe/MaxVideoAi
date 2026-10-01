'use client';

import { Button } from '@/components/ui/Button';
import type { useSeedanceDraftLocalPreview } from '../_hooks/useSeedanceDraftLocalPreview';

export function SeedanceDraftLocalPreviewResult({ preview }: { preview: ReturnType<typeof useSeedanceDraftLocalPreview> }) {
  if (!preview.available || !preview.selected || preview.phase === 'setup') return null;

  const currency = preview.finalQuote?.status === 'exact' ? preview.finalQuote.currency : 'USD';
  const format = (cents: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
  const finalPrice = preview.finalQuote?.status === 'exact' ? format(preview.finalQuote.amountCents) : null;
  const trialPrice = preview.trialQuote?.status === 'exact' ? format(preview.trialQuote.amountCents) : null;
  const total = preview.combinedReferenceCents !== null ? format(preview.combinedReferenceCents) : null;
  const canConfirm = Boolean(finalPrice && trialPrice && total && !preview.pending);

  return (
    <section aria-label="Résultat de votre essai" className="rounded-card border border-hairline bg-surface px-4 py-3 text-sm" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Résultat simulé</p>
          <p className="mt-1 font-semibold text-text-primary">
            {preview.phase === 'final' ? 'Votre vidéo finale est prête · 1080p' : 'Votre essai est prêt · 480p'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {preview.snapshot?.durationSec} s · {preview.snapshot?.aspectRatio} · {preview.snapshot?.audio ? 'Avec audio' : 'Sans audio'}
          </p>
        </div>
        {preview.phase === 'draft' ? (
          <Button size="sm" onClick={() => void preview.requestFinal()}>Passer au rendu final 1080p</Button>
        ) : null}
        {preview.phase === 'final' ? <Button size="sm" variant="outline" onClick={preview.cancel}>Revoir l’essai 480p</Button> : null}
      </div>
      {preview.phase === 'draft' ? (
        <p className="mt-2 text-xs text-text-secondary">Le résultat vous convient ? Lancez le final en 1080p. C’est facultatif et facturé en supplément.</p>
      ) : null}
      {preview.phase === 'confirm' ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="font-semibold text-text-primary">Lancer la vidéo finale en 1080p ?</p>
          <p className="mt-1 text-xs text-text-secondary">Un nouveau rendu à partir de cet essai. Vous conservez aussi la version 480p.</p>
          {canConfirm ? (
            <dl aria-label="Prix de référence des deux étapes" className="mt-3 space-y-2 rounded-input bg-surface-2 p-3 text-xs">
              <div className="flex justify-between gap-3"><dt>Essai 480p</dt><dd className="font-semibold tabular-nums">{trialPrice}</dd></div>
              <div className="flex justify-between gap-3"><dt>Final 1080p · en supplément</dt><dd className="font-semibold tabular-nums">+ {finalPrice}</dd></div>
              <div className="flex justify-between gap-3 border-t border-hairline pt-2 font-semibold"><dt>Total essai + final</dt><dd className="tabular-nums">{total}</dd></div>
            </dl>
          ) : <p role="status" className="mt-3 text-xs text-text-secondary">{preview.pending ? 'Chargement des prix…' : preview.error}</p>}
          <p className="mt-2 text-[11px] text-text-muted">Prix classiques de référence pour cette maquette ; tarifs essai et final à valider.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={!canConfirm} onClick={preview.confirmSimulation}>
              {finalPrice ? `Lancer le final · ${finalPrice}` : 'Lancer le rendu final'}
            </Button>
            <Button size="sm" variant="outline" onClick={preview.cancel}>Garder l’essai uniquement</Button>
          </div>
        </div>
      ) : null}
      {preview.phase === 'final' ? (
        <p className="mt-2 text-xs text-text-secondary">L’essai 480p et le final 1080p sont deux rendus distincts. Cette maquette n’a lancé aucune génération.</p>
      ) : null}
    </section>
  );
}
