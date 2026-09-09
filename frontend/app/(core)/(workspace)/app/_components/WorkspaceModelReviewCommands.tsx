'use client';
import { Scale } from 'lucide-react';
import type { useWorkspaceModelReview } from '../_hooks/useWorkspaceModelReview';
import { workspaceModelReviewCopy } from '../_lib/workspace-model-review-copy';
import styles from './workspace-model-review.module.css';
type Review = ReturnType<typeof useWorkspaceModelReview>;
export function WorkspaceModelReviewCommands({ review, locale }: { review: Review; locale: string }) {
  const copy = workspaceModelReviewCopy(locale);
  return (
    <div className={styles.commands}>
      <button
        type="button"
        data-model-review-opener
        disabled={!review.commandsAvailable}
        aria-label={review.waitingForAccount ? copy.authPending : copy.compare}
        title={review.waitingForAccount ? copy.authPending : undefined}
        onClick={() => review.open('compare')}
      >
        <Scale className={styles.commandIcon} aria-hidden="true" strokeWidth={2} />
        <span className={styles.commandLabel}>
          {review.waitingForAccount ? copy.authPending : copy.compare}
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
