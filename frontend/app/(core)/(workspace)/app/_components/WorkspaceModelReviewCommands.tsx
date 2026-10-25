'use client';
import { History, Scale } from 'lucide-react';
import type { useWorkspaceModelReview } from '../_hooks/useWorkspaceModelReview';
import { workspaceModelReviewCopy } from '../_lib/workspace-model-review-copy';
import styles from './workspace-model-review.module.css';
type Review = ReturnType<typeof useWorkspaceModelReview>;
export function WorkspaceModelReviewCommands({ review, locale, savedOnly = false }: { review: Review; locale: string; savedOnly?: boolean }) {
  const copy = workspaceModelReviewCopy(locale);
  const label = savedOnly ? copy.saved : copy.compare;
  const Icon = savedOnly ? History : Scale;
  return (
    <div className={styles.commands}>
      <button
        type="button"
        data-model-review-opener
        disabled={!review.commandsAvailable}
        aria-label={review.waitingForAccount ? copy.authPending : label}
        title={review.waitingForAccount ? copy.authPending : undefined}
        onClick={() => review.open(savedOnly ? 'saved' : 'compare')}
      >
        <Icon className={styles.commandIcon} aria-hidden="true" strokeWidth={2} />
        <span className={styles.commandLabel}>
          {review.waitingForAccount ? copy.authPending : label}
        </span>
      </button>
      {review.memoryOnly ? (
        <span className={styles.status} role="status" title={copy.memory}>
          {copy.memoryShort}
        </span>
      ) : null}
    </div>
  );
}
