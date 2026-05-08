import { useEffect, useRef } from 'react';

interface UseCharacterBuilderResultsInfiniteScrollOptions {
  hasMore: boolean;
  resultsLength: number;
  loadMoreResults: () => void;
}

export function useCharacterBuilderResultsInfiniteScroll({
  hasMore,
  resultsLength,
  loadMoreResults,
}: UseCharacterBuilderResultsInfiniteScrollOptions) {
  const resultsScrollContainerRef = useRef<HTMLDivElement>(null!);
  const resultsSentinelRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    const sentinel = resultsSentinelRef.current;
    if (!sentinel || !hasMore) return;

    let previousY = 0;
    let previousRatio = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            (entry.boundingClientRect.y > previousY || entry.intersectionRatio > previousRatio)
          ) {
            loadMoreResults();
          }
          previousY = entry.boundingClientRect.y;
          previousRatio = entry.intersectionRatio;
        });
      },
      {
        root: resultsScrollContainerRef.current,
        threshold: 0.2,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, resultsLength, loadMoreResults]);

  useEffect(() => {
    const scrollContainer = resultsScrollContainerRef.current;
    if (!scrollContainer || !hasMore) return undefined;

    const maybeLoadMore = () => {
      const remainingScroll = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      if (remainingScroll <= 320) {
        loadMoreResults();
      }
    };

    maybeLoadMore();
    scrollContainer.addEventListener('scroll', maybeLoadMore, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', maybeLoadMore);
  }, [hasMore, resultsLength, loadMoreResults]);

  return {
    resultsScrollContainerRef,
    resultsSentinelRef,
  };
}
