'use client';

import { createContext, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useGalleryReader } from '@/components/examples/useGalleryReader';
import type { AppLocale } from '@/i18n/locales';
import { trackComparison } from '../_lib/compare-analytics';

const ExampleReader = dynamic(() => import('@/components/examples/ExampleReader.client'), { ssr: false });

type VideoLink = { id: string; href: string };
type ComparisonVideo = VideoLink & { engine: string };
type ReaderContext = { isOpen: boolean; open: (video: VideoLink) => void };

export const CompareGalleryReaderContext = createContext<ReaderContext | null>(null);

export function CompareGalleryReader({ videos, locale, children }: {
  videos: ComparisonVideo[]; locale: AppLocale; children: ReactNode;
}) {
  const reader = useGalleryReader(videos, { keepPageUrl: true });
  const selected = videos.find(video => video.id === reader.selected);
  return (
    <CompareGalleryReaderContext.Provider value={{ isOpen: Boolean(selected), open: reader.open }}>
      {children}
      {selected && (
        <ExampleReader
          id={selected.id}
          locale={locale}
          onClose={reader.close}
          onComparisonPlayback={() => trackComparison({ action: 'video_play', engine: selected.engine, locale })}
          navigationError={reader.navigationError}
          navigation={{
            previous: () => void reader.step(-1),
            next: () => void reader.step(1),
            canPrevious: reader.canPrevious,
            canNext: reader.canNext,
            busy: reader.busy,
          }}
        />
      )}
    </CompareGalleryReaderContext.Provider>
  );
}
