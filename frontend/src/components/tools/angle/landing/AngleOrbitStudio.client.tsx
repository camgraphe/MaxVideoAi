'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ANGLE_ORBIT_ASSETS, type AngleLandingContent } from './angle-landing-assets';
import {
  ANGLE_ORBIT_VIEW_IDS,
  advanceOrbitView,
  resolveAvailableOrbitView,
  selectOrbitViewFromDrag,
  type AngleOrbitViewId,
} from './angle-orbit-state';
import styles from './AngleLanding.module.css';

const INITIAL_VIEW = ANGLE_ORBIT_VIEW_IDS[1];

type PointerStart = {
  id: number;
  x: number;
  view: AngleOrbitViewId;
};

export function AngleOrbitStudio({ content }: { content: AngleLandingContent['hero']['orbit'] }) {
  const [committedView, setCommittedView] = useState<AngleOrbitViewId>(INITIAL_VIEW);
  const [previewView, setPreviewView] = useState<AngleOrbitViewId | null>(null);
  const [failedViews, setFailedViews] = useState<ReadonlySet<AngleOrbitViewId>>(() => new Set());
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointerStart = useRef<PointerStart | null>(null);
  const activeView = resolveAvailableOrbitView(previewView ?? committedView, failedViews);
  const viewContent =
    content.views.find((view) => view.id === activeView) ??
    content.views.find((view) => view.id === INITIAL_VIEW) ??
    content.views[0];

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const preload = () => {
      for (const viewId of ANGLE_ORBIT_VIEW_IDS) {
        if (viewId === INITIAL_VIEW) continue;
        const preloadImage = new window.Image();
        preloadImage.src = ANGLE_ORBIT_ASSETS.hero[viewId];
      }
    };

    const requestIdle = window.requestIdleCallback;
    if (typeof requestIdle === 'function') {
      const idleId = window.requestIdleCallback(preload);
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(preload, 250);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const markFailed = useCallback((viewId: AngleOrbitViewId) => {
    setFailedViews((current) => {
      if (current.has(viewId)) return current;
      const next = new Set(current);
      next.add(viewId);
      return next;
    });
  }, []);

  const chooseAdjacentView = (direction: 'next' | 'previous') => {
    const target = advanceOrbitView(activeView, direction);
    setCommittedView(resolveAvailableOrbitView(target, failedViews));
    setPreviewView(null);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || pointerStart.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = { id: event.pointerId, x: event.clientX, view: activeView };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const target = selectOrbitViewFromDrag(start.view, event.clientX - start.x);
    setPreviewView(resolveAvailableOrbitView(target, failedViews));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const target = selectOrbitViewFromDrag(start.view, event.clientX - start.x);
    setCommittedView(resolveAvailableOrbitView(target, failedViews));
    setPreviewView(null);
    pointerStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current?.id !== event.pointerId) return;
    pointerStart.current = null;
    setPreviewView(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    chooseAdjacentView(event.key === 'ArrowLeft' ? 'previous' : 'next');
  };

  const activeIndex = ANGLE_ORBIT_VIEW_IDS.indexOf(activeView);
  const liveMessage = `${content.livePrefix}: ${viewContent.label}`;

  return (
    <div className={styles.heroStage}>
      <div
        className={styles.orbitTrack}
        role="slider"
        tabIndex={0}
        aria-label={content.dragLabel}
        aria-valuemin={1}
        aria-valuemax={ANGLE_ORBIT_VIEW_IDS.length}
        aria-valuenow={activeIndex + 1}
        aria-valuetext={`${viewContent.label}, ${viewContent.degreeLabel}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        <Image
          key={activeView}
          src={ANGLE_ORBIT_ASSETS.hero[activeView]}
          alt={viewContent.alt}
          fill
          priority={activeView === INITIAL_VIEW}
          sizes="(max-width: 1024px) 100vw, 58vw"
          onError={() => markFailed(activeView)}
          className={reducedMotion ? styles.orbitImageReduced : styles.orbitImage}
        />
        <div className="pointer-events-none absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 text-[#292724] sm:inset-x-7 sm:bottom-7">
          <p className="rounded-full border border-[#d6cfc3]/80 bg-[#fffdf8]/90 px-4 py-2 text-xs font-semibold shadow-[0_10px_28px_rgba(45,40,34,0.08)] backdrop-blur-sm">
            {viewContent.label}
          </p>
          <p className="rounded-full border border-[#d6cfc3]/80 bg-[#fffdf8]/90 px-4 py-2 text-xs font-medium shadow-[0_10px_28px_rgba(45,40,34,0.08)] backdrop-blur-sm">
            {viewContent.degreeLabel}
          </p>
        </div>
      </div>

      <div className={styles.orbitControls}>
        <button className={styles.orbitButton} type="button" aria-label={content.previousLabel} onClick={() => chooseAdjacentView('previous')}>
          <span aria-hidden="true">←</span>
        </button>
        <p>{content.dragLabel}</p>
        <button className={styles.orbitButton} type="button" aria-label={content.nextLabel} onClick={() => chooseAdjacentView('next')}>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </p>
      <p className="text-center text-xs leading-5 text-[#6f6a63]">{content.fallbackNote}</p>
    </div>
  );
}
