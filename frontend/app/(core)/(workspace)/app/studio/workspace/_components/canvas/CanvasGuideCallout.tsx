'use client';

import {
  Grip,
  Trash2,
} from 'lucide-react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  Ref,
} from 'react';
import type { StudioCopy } from '../../../_lib/studio-copy';
import type { WorkspaceGuideAnnotation } from '../../_lib/workspace-types';
import styles from '../../_styles/canvas-guide.module.css';

type GuideStepCopy = StudioCopy['canvas']['guide']['steps'][WorkspaceGuideAnnotation['copyKey']];

export const WORKSPACE_GUIDE_HIGHLIGHT_DURATION_MS = 1_200;

export function highlightWorkspaceGuideTargets(targets: Array<Element | null>): () => void {
  const uniqueTargets = [...new Set(targets.filter((target): target is Element => Boolean(target)))];
  uniqueTargets.forEach((target) => {
    target.setAttribute('data-guide-highlighted', 'true');
    target.classList.add(styles.guideHighlighted);
  });
  const timeout = window.setTimeout(() => {
    uniqueTargets.forEach((target) => {
      target.removeAttribute('data-guide-highlighted');
      target.classList.remove(styles.guideHighlighted);
    });
  }, WORKSPACE_GUIDE_HIGHLIGHT_DURATION_MS);

  return () => {
    window.clearTimeout(timeout);
    uniqueTargets.forEach((target) => {
      target.removeAttribute('data-guide-highlighted');
      target.classList.remove(styles.guideHighlighted);
    });
  };
}

export type CanvasGuideCalloutProps = {
  actionTraySide?: 'left' | 'right';
  annotation: WorkspaceGuideAnnotation;
  calloutRef?: Ref<HTMLElement>;
  className?: string;
  collapsed: boolean;
  controlsCopy: StudioCopy['canvas']['guide']['controls'];
  draggable?: boolean;
  guidePosition: number;
  guideSize: number;
  activeStep?: number;
  onActivate: () => void;
  onCollapse: () => void;
  onDelete: () => void;
  onDragPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragLostPointerCapture?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  surface?: boolean;
  stepCopy: GuideStepCopy;
  style?: CSSProperties;
};

function focusAdjacentGuideAnnotation(current: HTMLElement, direction: -1 | 1): boolean {
  const annotations = Array.from(document.querySelectorAll<HTMLElement>('[data-canvas-guide-annotation]'))
    .filter((annotation) => annotation.getClientRects().length > 0)
    .sort((left, right) => Number(left.dataset.guideStep) - Number(right.dataset.guideStep));
  const currentIndex = annotations.findIndex((annotation) => annotation === current);
  const next = currentIndex >= 0 ? annotations[currentIndex + direction] : null;
  if (!next) return false;
  next.focus();
  return true;
}

export function CanvasGuideCallout({
  actionTraySide = 'right',
  annotation,
  calloutRef,
  className,
  collapsed,
  controlsCopy,
  draggable = true,
  guidePosition,
  guideSize,
  activeStep,
  onActivate,
  onCollapse,
  onDelete,
  onDragPointerCancel,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragLostPointerCapture,
  surface = false,
  stepCopy,
  style,
}: CanvasGuideCalloutProps) {
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onActivate();
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      event.stopPropagation();
      onDelete();
      return;
    }
    if (event.key === 'Escape' && !collapsed) {
      event.preventDefault();
      event.stopPropagation();
      onCollapse();
      return;
    }
    if (event.key === 'Tab' && focusAdjacentGuideAnnotation(event.currentTarget, event.shiftKey ? -1 : 1)) {
      event.preventDefault();
    }
  };

  return (
    <article
      ref={calloutRef}
      className={`${collapsed ? styles.badge : styles.callout} ${className ?? ''}`}
      data-canvas-guide-annotation={annotation.id}
      data-guide-step={annotation.order}
      data-guide-collapsed={collapsed ? 'true' : 'false'}
      data-guide-active-step={activeStep}
      data-guide-action-tray-side={collapsed ? actionTraySide : undefined}
      data-guide-surface-annotation={surface ? 'true' : undefined}
      aria-label={stepCopy.ariaLabel}
      aria-posinset={guidePosition}
      aria-setsize={guideSize}
      tabIndex={0}
      style={style}
      onClick={collapsed ? onActivate : undefined}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className={styles.stepNumber}>{annotation.order}</span>
      {collapsed ? null : (
        <div className={styles.annotationCopy}>
          <strong>{stepCopy.title}</strong>
          <p>{stepCopy.body}</p>
        </div>
      )}
      <div className={styles.annotationActions}>
        {draggable ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={controlsCopy.move}
            data-guide-drag-handle="true"
            onClick={(event) => event.stopPropagation()}
            onPointerCancel={onDragPointerCancel}
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onLostPointerCapture={onDragLostPointerCapture}
          >
            <Grip size={14} aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${controlsCopy.deleteOne}: ${stepCopy.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
