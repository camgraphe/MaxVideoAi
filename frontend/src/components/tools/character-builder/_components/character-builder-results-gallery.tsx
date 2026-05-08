'use client';

import type { RefObject } from 'react';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import type {
  CharacterBuilderResult,
  CharacterBuilderRun,
  CharacterBuilderSettingsSnapshot,
  CharacterBuilderState,
} from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import { findChoiceLabel } from '../_lib/character-builder-summary-helpers';
import {
  getFormatDisplayLabel,
  getResultActionLabel,
} from '../_lib/character-builder-helpers';
import type {
  ChoiceOption,
  HistoricalCharacterGalleryItem,
  PendingCharacterRun,
} from '../_lib/character-builder-types';
import {
  EmptyResultsRail,
  PendingResultCard,
  ResultCard,
} from './character-builder-result-cards';

interface CharacterBuilderResultsGalleryProps {
  copy: CharacterCopy;
  flattenedResults: CharacterBuilderResult[];
  historicalHasMore: boolean;
  historicalIsFetchingMore: boolean;
  historicalJobsLoading: boolean;
  historicalResults: HistoricalCharacterGalleryItem[];
  outputModeLabelOptions: ChoiceOption[];
  pendingRuns: PendingCharacterRun[];
  qualityLabelOptions: ChoiceOption[];
  qualityMode: CharacterBuilderState['qualityMode'];
  resultsScrollContainerRef: RefObject<HTMLDivElement>;
  resultsSentinelRef: RefObject<HTMLDivElement>;
  runs: CharacterBuilderRun[];
  savingResultId: string | null;
  selectedResultId: string | null;
  variant: 'desktop' | 'mobile';
  onDuplicateHistoricalSettings: (item: HistoricalCharacterGalleryItem) => void;
  onDuplicateSettings: (snapshot: CharacterBuilderSettingsSnapshot, selectedId: string) => void;
  onOpenLightbox: (entry: MediaLightboxEntry) => void;
  onSaveHistoricalResult: (item: HistoricalCharacterGalleryItem) => void;
  onSaveResult: (result: CharacterBuilderResult) => void;
  onSelectResult: (resultId: string) => void;
}

export function CharacterBuilderResultsGallery({
  copy,
  flattenedResults,
  historicalHasMore,
  historicalIsFetchingMore,
  historicalJobsLoading,
  historicalResults,
  outputModeLabelOptions,
  pendingRuns,
  qualityLabelOptions,
  qualityMode,
  resultsScrollContainerRef,
  resultsSentinelRef,
  runs,
  savingResultId,
  selectedResultId,
  variant,
  onDuplicateHistoricalSettings,
  onDuplicateSettings,
  onOpenLightbox,
  onSaveHistoricalResult,
  onSaveResult,
  onSelectResult,
}: CharacterBuilderResultsGalleryProps) {
  const hasResults = flattenedResults.length > 0 || pendingRuns.length > 0 || historicalResults.length > 0;
  if (!hasResults) {
    return variant === 'desktop' ? <EmptyResultsRail copy={copy} /> : null;
  }

  const itemClassName = variant === 'desktop' ? '' : 'min-w-[280px] shrink-0 snap-start';
  const items = (
    <>
      {pendingRuns.map((pendingRun) => {
        const pendingOutputLabel =
          findChoiceLabel(outputModeLabelOptions, pendingRun.outputMode) ?? copy.generatePanel.portraitTitle;
        const pendingQualityLabel =
          findChoiceLabel(qualityLabelOptions, pendingRun.qualityMode) ?? copy.options.quality.draft.label;
        const pendingFormatLabel = getFormatDisplayLabel(copy, pendingRun.formatMode, pendingRun.qualityMode);
        const subtitle = `${pendingOutputLabel} · ${pendingQualityLabel} · ${pendingFormatLabel}`;
        const badge = pendingRun.generateCount === 4 ? '4x' : null;
        return (
          <div key={pendingRun.id} className={itemClassName}>
            <PendingResultCard
              title={getResultActionLabel(copy, pendingRun.action)}
              subtitle={subtitle}
              badge={badge}
              copy={copy}
            />
          </div>
        );
      })}
      {flattenedResults.map((result) => {
        const run = runs.find((entry) => entry.id === result.runId);
        const resultOutputLabel =
          findChoiceLabel(outputModeLabelOptions, result.outputMode) ?? copy.generatePanel.portraitTitle;
        const resultQualityLabel =
          findChoiceLabel(qualityLabelOptions, result.qualityMode) ?? copy.options.quality.draft.label;
        const resultFormatLabel = getFormatDisplayLabel(copy, run?.formatMode ?? 'standard', result.qualityMode);
        const subtitle = `${resultOutputLabel} · ${resultQualityLabel} · ${resultFormatLabel}`;
        const badge = run && run.results.length > 1 ? `${run.results.length}x` : null;
        const title = getResultActionLabel(copy, result.action);

        return (
          <div key={result.id} className={itemClassName}>
            <ResultCard
              result={result}
              selected={selectedResultId === result.id}
              title={title}
              subtitle={subtitle}
              badge={badge}
              saving={savingResultId === result.id}
              onOpen={() => {
                onSelectResult(result.id);
                onOpenLightbox({
                  id: result.id,
                  label: title,
                  thumbUrl: result.url,
                  mediaType: 'image',
                  status: 'completed',
                  engineLabel: result.engineLabel,
                  createdAt: result.createdAt,
                  jobId: result.jobId,
                  prompt: run?.settingsSnapshot?.prompt ?? null,
                });
              }}
              onSelect={() => onSelectResult(result.id)}
              onDownload={() =>
                triggerAppDownload(
                  result.url,
                  suggestDownloadFilename(result.url, `character-reference-${result.id.replace(/[^a-z0-9]+/gi, '-')}`)
                )
              }
              onSave={() => onSaveResult(result)}
              onDuplicateSettings={() => {
                if (run?.settingsSnapshot) {
                  onDuplicateSettings(run.settingsSnapshot, result.id);
                }
              }}
              copy={copy}
            />
          </div>
        );
      })}
      {historicalResults.map((item) => {
        const createdLabel = formatHistoricalCreatedAt(item.createdAt);

        return (
          <div key={item.id} className={itemClassName}>
            <ResultCard
              result={{
                id: item.id,
                runId: item.jobId,
                jobId: item.jobId,
                url: item.imageUrl,
                thumbUrl: item.thumbUrl,
                engineId: '',
                engineLabel: item.engineLabel,
                action: 'generate',
                outputMode: 'portrait-reference',
                qualityMode,
                createdAt: item.createdAt,
              }}
              selected={selectedResultId === item.id}
              title={copy.resultCard.referenceOutput}
              subtitle={`${item.engineLabel} · ${createdLabel}`}
              saving={savingResultId === item.id}
              onOpen={() => {
                onSelectResult(item.id);
                onOpenLightbox({
                  id: item.id,
                  label: copy.resultCard.referenceOutput,
                  thumbUrl: item.imageUrl,
                  mediaType: 'image',
                  status: 'completed',
                  engineLabel: item.engineLabel,
                  createdAt: item.createdAt,
                  jobId: item.jobId,
                  prompt: item.prompt,
                });
              }}
              onSelect={() => onSelectResult(item.id)}
              onDownload={() =>
                triggerAppDownload(
                  item.imageUrl,
                  suggestDownloadFilename(item.imageUrl, `character-reference-${item.id.replace(/[^a-z0-9]+/gi, '-')}`)
                )
              }
              onSave={() => onSaveHistoricalResult(item)}
              onDuplicateSettings={() => onDuplicateHistoricalSettings(item)}
              copy={copy}
            />
          </div>
        );
      })}
    </>
  );

  if (variant === 'desktop') {
    return (
      <div className="relative flex-1 min-h-0">
        <div ref={resultsScrollContainerRef} className="scrollbar-rail h-full overflow-y-auto space-y-3 pr-4 pt-1">
          {items}
          {historicalHasMore ? <div ref={resultsSentinelRef} className="h-6" /> : null}
          {historicalIsFetchingMore || historicalJobsLoading ? (
            <div className="flex justify-center py-3 text-xs font-medium text-text-secondary">
              {copy.resultCard.pending}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">{items}</div>;
}

function formatHistoricalCreatedAt(createdAt: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(createdAt));
  } catch {
    return createdAt;
  }
}
