'use client';

import { useEffect, useId, type KeyboardEvent } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { useAccessibleModal, resolveModalTabTarget } from '@/components/ui/useAccessibleModal';
import type { EngineCaps } from '@/types/engines';
import type { useWorkspaceModelReview } from '../_hooks/useWorkspaceModelReview';
import { workspaceModelReviewCopy } from '../_lib/workspace-model-review-copy';
import {
  describeWorkspaceModelReferences,
  workspaceModelReviewChangeRows,
} from '../_lib/workspace-model-review-presentation';
import {
  resolveWorkspaceComposerFacts,
  resolveWorkspaceWorkflow,
} from '../_lib/workspace-workflow-projection';
import type { WorkspaceModelSetup } from '../_lib/workspace-model-candidate';
import styles from './workspace-model-review.module.css';

type Review = ReturnType<typeof useWorkspaceModelReview>;

// EngineSelect owns its portaled browsers. Keep Tab within the active child browser;
// Escape and selection remain with its existing keyboard handlers.
function containSelectorPortalTab(event: KeyboardEvent<HTMLDivElement>) {
  const portal = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-engine-select-portal], [data-engine-browse-portal]',
  );
  if (!portal || event.key !== 'Tab') return;
  const focusable = Array.from(
    portal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length > 0,
  );
  const target = resolveModalTabTarget({
    activeIndex: focusable.indexOf(document.activeElement as HTMLElement),
    focusableCount: focusable.length,
    shiftKey: event.shiftKey,
    activeInside: portal.contains(document.activeElement),
  });
  if (target === null) return;
  event.preventDefault();
  (target < 0 ? portal : focusable[target])?.focus();
}

function Summary({
  setup,
  engine,
  title,
  price,
  currency,
  locale,
  status,
}: {
  setup: WorkspaceModelSetup;
  engine?: EngineCaps;
  title: string;
  price: number | null;
  currency: string;
  locale: string;
  status: string;
}) {
  const copy = workspaceModelReviewCopy(locale);
  const workflow = resolveWorkspaceWorkflow({ engine: engine ?? null, ...setup });
  const facts = resolveWorkspaceComposerFacts({ engine: engine ?? null, workflow, ...setup });
  const references = describeWorkspaceModelReferences(setup, engine, locale);
  const referenceKinds = Array.from(
    new Set(references.map((reference) => `${reference.kind}:${reference.label}`)),
  ).map((key) => {
    const matching = references.filter((reference) => `${reference.kind}:${reference.label}` === key);
    return { kind: matching[0].kind, label: matching[0].label, count: matching.length };
  });
  return (
    <section className={styles.column} aria-label={title}>
      <span className={styles.eyebrow}>{title}</span>
      <div className={styles.identity}>
        <EngineIcon engine={engine} size={30} />
        <span>{engine?.label ?? setup.form.engineId}</span>
      </div>
      <div className={styles.chips}>
        <span>{facts.effectiveDurationSec}s</span>
        <span>{setup.form.resolution}</span>
        <span>{setup.form.aspectRatio}</span>
        <span>
          {copy.audio}:{' '}
          {workflow.supportsAudioToggle
            ? setup.form.audio
              ? copy.on
              : copy.off
            : engine?.audio
              ? copy.includedAudio
              : copy.off}
        </span>
        <span>×{setup.form.iterations}</span>
      </div>
      <p className={styles.status}>
        {references.length} {(references.length === 1 ? copy.reference : copy.references).toLowerCase()}
      </p>
      {referenceKinds.length ? (
        <div className={styles.referenceCounts}>
          {referenceKinds.map(({ kind, label, count }) => (
            <span key={`${kind}:${label}`}>
              <AppGlyph name={kind} />
              {label} · {count}
            </span>
          ))}
        </div>
      ) : null}
      <strong className={styles.price}>
        {price === null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(price)}
      </strong>
      {status ? <p className={styles.status}>{status}</p> : null}
    </section>
  );
}
export function WorkspaceModelReview({
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
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: review.close });
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (!(opener instanceof HTMLElement) || opener === document.body || !opener.isConnected)
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('[data-model-review-opener]')?.focus({ preventScroll: true }),
        );
    };
  }, []);
  const { candidate, current, target } = review;
  const currentEngine = engines.find((engine) => engine.id === current?.form.engineId);
  const sourceReferences = current ? describeWorkspaceModelReferences(current, currentEngine, locale) : [];
  const displayChanges =
    candidate && target ? workspaceModelReviewChangeRows(candidate, currentEngine, target, locale) : [];
  return (
    <div
      className={styles.backdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) review.close();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (!dialogRef.current?.contains(event.target as Node)) {
            containSelectorPortalTab(event);
            return;
          }
          if (
            event.key === 'Escape' &&
            dialogRef.current.querySelector('[aria-haspopup="dialog"][aria-expanded="true"]')
          )
            return;
          onDialogKeyDown(event);
        }}
        className={styles.dialog}
      >
        <header className={styles.header}>
          <h2 id={titleId}>{review.panel === 'saved' ? copy.saved : copy.title}</h2>
          <button type="button" data-modal-initial-focus onClick={review.close}>
            {copy.close}
          </button>
        </header>
        <div className={styles.body}>
          <div className={styles.tabs}>
            <button
              type="button"
              aria-pressed={review.panel === 'compare'}
              onClick={() => review.open('compare')}
            >
              {copy.compare}
            </button>
            <button
              type="button"
              aria-pressed={review.panel === 'saved'}
              onClick={() => review.open('saved')}
            >
              {copy.saved}
            </button>
          </div>
          {review.error ? (
            <div role="alert">
              <p className={styles.status}>{copy[review.error]}</p>
              {review.storageError ? (
                <button type="button" onClick={review.clearUnreadableStore}>
                  {copy.clear}
                </button>
              ) : null}
            </div>
          ) : null}
          {review.memoryOnly ? (
            <p role="status" className={styles.status}>
              {copy.memory}
            </p>
          ) : null}
          {review.panel === 'saved' ? (
            <>
              {!review.savedSetups.length ? <p className={styles.muted}>{copy.empty}</p> : null}
              {review.savedSetups.map(({ modelId, saved, engine }) => (
                <div className={styles.saved} key={modelId}>
                  <EngineIcon engine={engine} size={30} />
                  <div className={styles.savedInfo}>
                    <strong>{engine?.label ?? modelId}</strong>
                    <p className={styles.status}>
                      {!saved
                        ? copy.invalid
                        : !engine || engine.availability === 'paused'
                          ? copy.unavailable
                          : `${saved.setup.form.durationSec}s · ${saved.setup.form.resolution}`}
                    </p>
                  </div>
                  <div className={styles.savedActions}>
                    <button
                      type="button"
                      disabled={
                        !saved ||
                        !engine ||
                        engine.availability === 'paused' ||
                        Boolean(review.disabledEngineReasons?.[modelId])
                      }
                      onClick={() => review.selectSavedSetup(modelId)}
                    >
                      {copy.restore}
                    </button>
                    <button
                      type="button"
                      aria-label={`${copy.remove} ${engine?.label ?? modelId}`}
                      onClick={() => review.removeSavedSetup(modelId)}
                    >
                      {copy.remove}
                    </button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {current ? (
                <EngineSelect
                  engines={engines}
                  engineId={target?.id ?? current.form.engineId}
                  onEngineChange={review.requestModel}
                  mode={candidate?.workflow.activeMode ?? current.form.mode}
                  onModeChange={() => {}}
                  showModeSelect={false}
                  showBillingNote={false}
                  disabledEngineReasons={review.disabledEngineReasons}
                  controlPresentation="workspace"
                  density="compact"
                  variant="bar"
                />
              ) : null}
              {candidate && current && target ? (
                <>
                  <div className={styles.columns}>
                    <Summary
                      setup={current}
                      engine={engines.find((e) => e.id === current.form.engineId)}
                      title={copy.current}
                      price={currentPrice}
                      currency={currentCurrency}
                      locale={locale}
                      status={currentPricing ? copy.loading : currentError ? copy.quoteError : ''}
                    />
                    <Summary
                      setup={candidate.setup}
                      engine={target}
                      title={copy.candidate}
                      price={review.configurationOnly ? null : review.quote.price}
                      currency={review.quote.currency}
                      locale={locale}
                      status={
                        review.configurationOnly
                          ? copy.noQuote
                          : review.quote.isPricing
                            ? copy.loading
                            : review.quote.preflightError
                              ? copy.quoteError
                              : ''
                      }
                    />
                  </div>
                  <p className={styles.status}>{candidate.comparable ? copy.equivalent : copy.adapted}</p>
                  {displayChanges.length ? (
                    <ul className={styles.changes} aria-label={copy.changes}>
                      {displayChanges.map((change, index) => (
                        <li key={`${change.field}-${index}`}>
                          <span>{change.label}</span>
                          <span>
                            {change.before} → <strong>{change.after}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {candidate.removedReferences.length ? (
                    <details open>
                      <summary>
                        {copy.preserved} ·{' '}
                        {engines.find((e) => e.id === current.form.engineId)?.label ?? current.form.engineId}{' '}
                        ({candidate.removedReferences.length})
                      </summary>
                      <ul className={styles.references}>
                        {candidate.removedReferences.map((reference, index) => {
                          const row = sourceReferences.find(
                            (row) =>
                              row.fieldId === reference.fieldId &&
                              row.index === reference.index &&
                              row.elementId === reference.elementId,
                          );
                          return (
                            <li key={index}>
                              <AppGlyph name={reference.asset.kind} />
                              <div className={styles.referenceIdentity}>
                                <strong>
                                  {row?.label ?? copy.unknown}
                                  {reference.index > 0 ? ` · ${reference.index + 1}` : ''}
                                </strong>
                                <span className={styles.referenceName} title={reference.asset.name}>
                                  {reference.asset.name}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}
                  {candidate.blockingReasons.map((reason, index) => (
                    <p key={`${reason.code}-${index}`} className={styles.status} role="status">
                      {copy.reasons[reason.code]}
                    </p>
                  ))}
                  {review.configurationOnly ? (
                    <p className={styles.status}>{copy.configurationReason}</p>
                  ) : null}
                  {review.quote.preflightError ? (
                    <button type="button" onClick={review.retry}>
                      {copy.retry}
                    </button>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
        <footer className={styles.footer}>
          <button type="button" onClick={review.close}>
            {copy.cancel}
          </button>
          {review.panel === 'compare' && candidate ? (
            <button type="button" className={styles.apply} disabled={!review.canApply} onClick={review.apply}>
              {review.configurationOnly ? copy.configurationOnly : copy.apply}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
