import { useCallback, useMemo } from 'react';
import { useInfiniteJobs } from '@/lib/api';
import type { CharacterBuilderResult } from '@/types/character-builder';
import type { HistoricalCharacterGalleryItem } from '../_lib/character-builder-types';

export function useCharacterBuilderHistoricalResults(flattenedResults: CharacterBuilderResult[]) {
  const {
    data: historicalJobPages,
    stableJobs: historicalJobs,
    mutate: mutateHistoricalJobs,
    setSize: setHistoricalSize,
    isLoading: historicalJobsLoading,
    isValidating: historicalJobsValidating,
  } = useInfiniteJobs(18, { surface: 'character' });

  const localResultUrls = useMemo(
    () => new Set(flattenedResults.map((result) => result.url).filter((value): value is string => Boolean(value))),
    [flattenedResults]
  );

  const historicalResults = useMemo<HistoricalCharacterGalleryItem[]>(() => {
    return historicalJobs.flatMap<HistoricalCharacterGalleryItem>((job) => {
      const renderIds = Array.isArray(job.renderIds) ? job.renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
      if (!renderIds.length) return [];
      const renderThumbUrls = Array.isArray(job.renderThumbUrls)
        ? job.renderThumbUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : [];

      return renderIds.reduce<HistoricalCharacterGalleryItem[]>((acc, imageUrl, index) => {
        if (localResultUrls.has(imageUrl)) return acc;
        acc.push({
          id: `${job.jobId}:historical:${index + 1}`,
          jobId: job.jobId,
          imageUrl,
          thumbUrl: renderThumbUrls[index] ?? imageUrl,
          engineLabel: job.engineLabel,
          createdAt: job.createdAt,
          prompt: job.prompt ?? null,
        });
        return acc;
      }, []);
    });
  }, [historicalJobs, localResultUrls]);

  const historicalLastPage = historicalJobPages?.[historicalJobPages.length - 1];
  const historicalHasMore = Boolean(historicalLastPage?.nextCursor);
  const historicalIsFetchingMore = historicalJobsValidating && Boolean(historicalJobPages?.length);
  const loadMoreHistoricalResults = useCallback(() => {
    if (!historicalHasMore || historicalJobsLoading || historicalIsFetchingMore) return;
    void setHistoricalSize((current) => current + 1);
  }, [historicalHasMore, historicalIsFetchingMore, historicalJobsLoading, setHistoricalSize]);

  return {
    historicalResults,
    historicalHasMore,
    historicalIsFetchingMore,
    historicalJobsLoading,
    loadMoreHistoricalResults,
    mutateHistoricalJobs,
  };
}
