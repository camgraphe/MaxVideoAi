'use client';

import { useEffect } from 'react';
import { usePathname } from '@/i18n/navigation';

/** A small enhancement: server content stays visible even without JavaScript. */
export function MarketingMotion() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const main = document.querySelector('.marketing-site > main');
    if (!main) return;
    const animations: Animation[] = [];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        animations.push(entry.target.animate(
          [{ transform: 'translateY(14px)' }, { transform: 'translateY(0)' }],
          { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' },
        ));
      });
    }, { threshold: 0.08 });
    main.querySelectorAll('section').forEach((section) => {
      // Never animate the initial viewport, its headline or its critical poster.
      if (section.getBoundingClientRect().top > window.innerHeight) observer.observe(section);
    });
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { observer.disconnect(); animations.forEach((animation) => animation.cancel()); };
    preference.addEventListener('change', stop);
    return () => { stop(); preference.removeEventListener('change', stop); };
  }, [pathname]);
  return null;
}
