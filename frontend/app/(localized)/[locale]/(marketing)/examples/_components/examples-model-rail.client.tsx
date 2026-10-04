'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ExamplesModelRail({ children, activeModel, previousLabel, nextLabel }: {
  children: ReactNode;
  activeModel: string | null;
  previousLabel: string;
  nextLabel: string;
}) {
  const id = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ previous: false, next: false });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => {
      const previous = rail.scrollLeft > 2;
      const next = rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 2;
      setEdges(current => current.previous === previous && current.next === next ? current : { previous, next });
    };
    const revealSelection = () => {
      const selected = rail.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected) return;
      const item = selected.getBoundingClientRect();
      const frame = rail.getBoundingClientRect();
      if (item.left < frame.left || item.right > frame.right) {
        rail.scrollLeft += item.left - frame.left - (rail.clientWidth - item.width) / 2;
      }
    };
    revealSelection();
    const observer = new ResizeObserver(() => { revealSelection(); update(); });
    observer.observe(rail);
    if (rail.firstElementChild) observer.observe(rail.firstElementChild);
    rail.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      rail.removeEventListener('scroll', update);
    };
  }, [activeModel]);

  const move = (direction: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.max(120, rail.clientWidth * 0.75),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="relative min-w-0 flex-1">
      <div ref={railRef} id={id} className="overflow-x-auto overscroll-x-contain scroll-px-12 rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {[{ key: 'previous', show: edges.previous, label: previousLabel, direction: -1, Icon: ChevronLeft },
        { key: 'next', show: edges.next, label: nextLabel, direction: 1, Icon: ChevronRight }].map(({ key, show, label, direction, Icon }) => (
        <div key={key} className={`pointer-events-none absolute inset-y-0 flex w-14 items-center ${direction < 0 ? 'left-0 justify-start bg-gradient-to-r' : 'right-0 justify-end bg-gradient-to-l'} from-surface via-surface/95 to-transparent ${show ? '' : 'invisible focus-within:visible'}`}>
          <button
            type="button"
            aria-label={label}
            title={label}
            aria-controls={id}
            aria-disabled={!show}
            tabIndex={show ? 0 : -1}
            onClick={() => { if (show) move(direction); }}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-text-primary shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default aria-disabled:opacity-40 motion-reduce:transition-none"
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
