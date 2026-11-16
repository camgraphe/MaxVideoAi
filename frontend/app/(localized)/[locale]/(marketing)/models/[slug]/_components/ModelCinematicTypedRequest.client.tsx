'use client';

import { useEffect, useRef, useState } from 'react';

/** Full SSR text reserves the line height; the decorative typing runs once on entry. */
export function ModelCinematicTypedRequest({ text }: { text: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<'static' | 'waiting' | 'typing' | 'done'>('static');
  const [visible, setVisible] = useState('');
  useEffect(() => {
    const node = root.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!node || motion.matches || !('IntersectionObserver' in window)) return;
    let frame = 0;
    let started = false;
    const letters = Array.from(text);
    const duration = Math.min(2100, Math.max(1100, letters.length * 30));
    setVisible('');
    setPhase('waiting');
    const observer = new IntersectionObserver(entries => {
      if (started || !entries.some(entry => entry.isIntersecting)) return;
      started = true;
      observer.disconnect();
      setPhase('typing');
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        setVisible(letters.slice(0, Math.floor(progress * letters.length)).join(''));
        if (progress < 1) frame = requestAnimationFrame(tick);
        else setPhase('done');
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' });
    observer.observe(node.closest('.cinema-milo-bar') ?? node);
    const reduceMotion = () => {
      if (!motion.matches) return;
      cancelAnimationFrame(frame);
      observer.disconnect();
      setPhase('done');
    };
    motion.addEventListener('change', reduceMotion);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); motion.removeEventListener('change', reduceMotion); };
  }, [text]);
  return <span ref={root} className="cinema-milo-request" data-typing={phase}>
    <span className="cinema-milo-full">{text}</span>
    {phase === 'waiting' || phase === 'typing' ? <span className="cinema-milo-typed" aria-hidden="true">{visible}{phase === 'typing' ? <i className="cinema-milo-caret" /> : null}</span> : null}
  </span>;
}
