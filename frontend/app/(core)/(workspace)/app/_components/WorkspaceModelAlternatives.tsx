'use client';

import { EngineIcon } from '@/components/ui/EngineIcon';
import { EngineSelect } from '@/components/ui/EngineSelect';
import type { EngineCaps } from '@/types/engines';
import type { useWorkspaceModelReview } from '../_hooks/useWorkspaceModelReview';
import { workspaceModelReviewCopy } from '../_lib/workspace-model-review-copy';
import {
  resolveWorkspaceComposerFacts,
  resolveWorkspaceWorkflow,
} from '../_lib/workspace-workflow-projection';
import styles from './workspace-model-review.module.css';

type Review = ReturnType<typeof useWorkspaceModelReview>;

function formatPrice(price: number | null, currency: string, locale: string) {
  return price === null
    ? null
    : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(price);
}

export function WorkspaceModelAlternatives({
  review,
  engines,
  locale,
  currentPrice,
  currentCurrency,
  currentPricing,
  currentError,
}: {
  review: Review;
  engines: EngineCaps[];
  locale: string;
  currentPrice: number | null;
  currentCurrency: string;
  currentPricing: boolean;
  currentError?: string;
}) {
  const copy = workspaceModelReviewCopy(locale);
  const current = review.current;
  const currentEngine = engines.find((engine) => engine.id === current?.form.engineId);
  if (!current) return null;
  const currentWorkflow = resolveWorkspaceWorkflow({ engine: currentEngine ?? null, ...current });
  const currentFacts = resolveWorkspaceComposerFacts({
    engine: currentEngine ?? null,
    workflow: currentWorkflow,
    ...current,
  });
  return (
    <>
      <p className={styles.compareIntro}>{copy.compareIntro}</p>
      <section className={styles.currentSetup} aria-label={copy.currentSetup}>
        <span className={styles.eyebrow}>{copy.currentSetup}</span>
        <div className={styles.currentSetupBody}>
          <div className={styles.identity}>
            <EngineIcon engine={currentEngine} size={30} />
            <span>{currentEngine?.label ?? current.form.engineId}</span>
          </div>
          <div className={styles.chips}>
            <span>{currentFacts.effectiveDurationSec}s</span>
            <span>{current.form.resolution}</span>
            <span>{current.form.aspectRatio}</span>
          </div>
          <strong className={styles.currentPrice}>
            {currentPricing
              ? copy.loading
              : currentError
                ? copy.quoteError
                : (formatPrice(currentPrice, currentCurrency, locale) ?? '—')}
          </strong>
        </div>
      </section>
      <div className={styles.alternativesHeading}>
        <h3>{copy.alternatives}</h3>
        <span>{review.alternatives.length}</span>
      </div>
      {review.alternatives.length ? (
        <div className={styles.alternativeList} role="list">
          {review.alternatives.map((alternative) => {
            const { engine, candidate } = alternative;
            const changeCount = candidate.changes.length + candidate.removedReferences.length;
            return (
              <button
                key={engine.id}
                type="button"
                role="listitem"
                className={styles.alternative}
                aria-label={`${copy.reviewAlternative} ${engine.label}`}
                onClick={() => review.requestModel(engine.id)}
              >
                <EngineIcon engine={engine} size={32} />
                <span className={styles.alternativeIdentity}>
                  <strong>{engine.label}</strong>
                  <small>{engine.version || engine.variant || engine.brandId || engine.id}</small>
                </span>
                <span className={styles.alternativeFit}>
                  <strong>{candidate.comparable ? copy.sameSettings : copy.adjustedSettings}</strong>
                  {!candidate.comparable ? (
                    <small>
                      {changeCount === 1 ? copy.oneChange : `${changeCount} ${copy.manyChanges}`}
                    </small>
                  ) : null}
                </span>
                <span className={styles.alternativeFacts}>
                  <span>{candidate.effectiveDurationSec}s</span>
                  <span>{candidate.setup.form.resolution}</span>
                  <span>{candidate.setup.form.aspectRatio}</span>
                </span>
                <strong className={styles.alternativePrice}>
                  {alternative.isPricing
                    ? copy.loading
                    : alternative.quoteError
                      ? copy.quoteError
                      : (formatPrice(alternative.price, alternative.currency, locale) ?? '—')}
                </strong>
                <span className={styles.alternativeAction}>{copy.reviewAlternative}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className={styles.muted}>{copy.noAlternatives}</p>
      )}
      <details className={styles.allModels}>
        <summary>{copy.browseAll}</summary>
        <div className={styles.allModelsControl}>
          <EngineSelect
            engines={engines}
            engineId={current.form.engineId}
            onEngineChange={review.requestModel}
            mode={current.form.mode}
            onModeChange={() => {}}
            showModeSelect={false}
            showBillingNote={false}
            disabledEngineReasons={review.disabledEngineReasons}
            controlPresentation="workspace"
            density="compact"
            variant="bar"
          />
        </div>
      </details>
    </>
  );
}
