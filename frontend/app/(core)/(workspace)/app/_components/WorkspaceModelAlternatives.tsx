'use client';

import { Plus, X, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { getModeLabel } from '@/components/ui/engine-select/engine-select-helpers';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { isVideoComparisonEngine } from '../_lib/workspace-model-alternatives';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { EngineCaps } from '@/types/engines';
import type { useWorkspaceModelReview } from '../_hooks/useWorkspaceModelReview';
import { workspaceModelReviewCopy } from '../_lib/workspace-model-review-copy';
import { resolveWorkspaceComposerFacts, resolveWorkspaceWorkflow } from '../_lib/workspace-workflow-projection';
import styles from './workspace-model-review.module.css';

type Review = ReturnType<typeof useWorkspaceModelReview>;
function formatPrice(price: number | null, currency: string, locale: string) {
  return price === null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(price);
}

export function WorkspaceModelAlternatives({ review, engines, locale, currentPrice, currentCurrency, currentPricing, currentError }: {
  review: Review; engines: EngineCaps[]; locale: string; currentPrice: number | null;
  currentCurrency: string; currentPricing: boolean; currentError?: string;
}) {
  const copy = workspaceModelReviewCopy(locale);
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const addLabel = fr ? 'Ajouter un modèle' : es ? 'Añadir modelo' : 'Add model';
  const current = review.current;
  const currentEngine = engines.find(engine => engine.id === current?.form.engineId);
  if (!current) return null;
  const currentWorkflow = resolveWorkspaceWorkflow({ engine: currentEngine ?? null, ...current });
  const currentFacts = resolveWorkspaceComposerFacts({ engine: currentEngine ?? null, workflow: currentWorkflow, ...current });
  const selected = new Set(review.alternatives.map(item => item.engine.id));
  const available = engines.filter(engine => isVideoComparisonEngine(engine) && engine.id !== current.form.engineId && review.comparison.availableIds.includes(engine.id));
  const pickerReasons = { ...review.disabledEngineReasons, ...Object.fromEntries([...selected].map(id => [id, fr ? 'Déjà ajouté' : es ? 'Ya añadido' : 'Already added'])) };
  return <>
    <section className={styles.currentSetup} aria-label={copy.currentSetup}>
      <div className={styles.currentSetupHeading}>
        <div>
          <span className={styles.eyebrow}>{copy.currentSetup}</span>
          <span className={styles.pricingBasis}>{copy.pricingBasis}</span>
        </div>
        <button type="button" className={styles.editSettings} onClick={review.close}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          {copy.editSettings}
        </button>
      </div>
      <div className={styles.currentSetupBody}>
        <div className={styles.identity}><EngineIcon engine={currentEngine} size={30} /><span>{currentEngine?.label ?? current.form.engineId}</span></div>
        <div className={styles.chips}><span>{currentFacts.effectiveDurationSec}s</span><span>{current.form.resolution}</span><span>{current.form.aspectRatio}</span><span>{current.form.iterations || 1}×</span></div>
        <strong className={styles.currentPrice}>{currentPricing ? copy.loading : currentError ? copy.quoteError : formatPrice(currentPrice, currentCurrency, locale)}</strong>
      </div>
    </section>
    <div className={styles.comparisonCards} role="list" aria-label={copy.alternatives}>
      {review.alternatives.map(alternative => {
        const { engine, candidate } = alternative;
        const blocked = !alternative.request;
        const changeCount = candidate.changes.length + candidate.removedReferences.length;
        const delta = candidate.comparable && !currentPricing && !currentError && currentPrice !== null && alternative.price !== null && alternative.currency === currentCurrency ? alternative.price - currentPrice : null;
        return <article key={engine.id} role="listitem" className={styles.comparisonCard}>
          <div className={styles.comparisonCardHeading}><EngineIcon engine={engine} size={30} /><strong>{engine.label}</strong><button type="button" aria-label={`${copy.remove} ${engine.label}`} title={copy.remove} onClick={() => review.comparison.remove(engine.id)}><X size={14} aria-hidden /></button></div>
          <div className={styles.comparisonPrice}><strong>{blocked ? '—' : alternative.isPricing ? '…' : alternative.quoteError ? copy.quoteError : formatPrice(alternative.price, alternative.currency, locale)}</strong>{delta !== null && Math.abs(delta) >= .005 ? <small>{delta < 0 ? '−' : '+'}{formatPrice(Math.abs(delta), alternative.currency, locale)}</small> : null}</div>
          <div className={styles.chips}><span>{candidate.effectiveDurationSec}s</span><span>{candidate.setup.form.resolution}</span><span>{candidate.setup.form.aspectRatio}</span>{candidate.changes.some(change => change.field === 'mode') ? <span>{getModeLabel(engine.id, candidate.workflow.submissionMode, locale)}</span> : null}</div>
          <div className={styles.comparisonCardFoot}><span>{blocked ? (fr ? 'Références ou réglages requis' : es ? 'Requiere referencias o ajustes' : 'References or settings needed') : candidate.comparable ? copy.sameSettings : `${changeCount} ${changeCount === 1 ? (fr ? 'ajustement' : es ? 'ajuste' : 'adjustment') : copy.manyChanges}`}</span>
            {alternative.quoteError ? <button type="button" onClick={review.comparison.retry}><RotateCcw size={14} aria-hidden />{copy.retry}</button> : <button type="button" disabled={!candidate.applicable || alternative.isPricing} onClick={() => review.requestModel(engine.id)}>{copy.reviewAlternative}</button>}
          </div>
        </article>;
      })}
      {review.alternatives.length < 6 && available.length ? <EngineSelect className={styles.addModelPicker}
        engines={available} selectedIds={[...selected]} engineId="" mode={current.form.mode} onModeChange={() => undefined}
        onEngineChange={id => review.comparison.add(id)} disabledEngineReasons={pickerReasons}
        showModeSelect={false} showBillingNote={false}
        trigger={{ label: addLabel, className: styles.addModelCard, content: <><Plus size={22} aria-hidden />{addLabel}</> }} /> : null}
    </div>
    {review.savedSetups.length ? <button className={styles.historyLink} type="button" onClick={() => review.open('saved')}><RotateCcw size={14} aria-hidden />{copy.saved}</button> : null}
  </>;
}
