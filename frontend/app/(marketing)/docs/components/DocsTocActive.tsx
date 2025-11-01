'use client';

import { useEffect } from 'react';

const SECTION_IDS = ['onboarding', 'pricing', 'refunds', 'safety', 'api', 'library'] as const;

export default function DocsTocActive() {
  useEffect(() => {
    const headings = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (node): node is HTMLElement => Boolean(node)
    );

    const linkMap = new Map<string, HTMLAnchorElement[]>();
    SECTION_IDS.forEach((id) => {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href="#${id}"]`));
      linkMap.set(id, anchors);
    });

    const clearActive = () => {
      linkMap.forEach((anchors) => {
        anchors.forEach((a) => {
          a.removeAttribute('aria-current');
          a.classList.remove('text-text-primary', 'text-foreground');
          a.classList.add('text-muted-foreground');
        });
      });
    };

    clearActive();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          const anchors = linkMap.get(id);
          if (!anchors?.length) return;
          clearActive();
          anchors.forEach((a) => {
            a.setAttribute('aria-current', 'true');
            a.classList.remove('text-muted-foreground');
            a.classList.add('text-text-primary', 'text-foreground');
          });
        });
      },
      {
        rootMargin: '0px 0px -60% 0px',
        threshold: 0.1,
      }
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, []);

  return null;
}
