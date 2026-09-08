'use client';
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
        title={review.waitingForAccount ? copy.authPending : undefined}
        onClick={() => review.open('compare')}
      >
        {review.waitingForAccount ? copy.authPending : copy.compare}
      </button>
      <button type="button" disabled={!review.commandsAvailable} onClick={() => review.open('saved')}>
        {copy.saved}
        {review.savedSetups.length ? ` · ${review.savedSetups.length}` : ''}
      </button>
      {review.memoryOnly ? (
        <span className={styles.status} role="status" title={copy.memory}>
          {copy.memoryShort}
        </span>
      ) : null}
    </div>
  );
}
