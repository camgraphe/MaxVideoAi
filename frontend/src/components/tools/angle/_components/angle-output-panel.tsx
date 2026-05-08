/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import type { AngleToolResponse } from '@/types/tools-angle';
import {
  ANGLE_GUEST_EXAMPLE_OUTPUT_URL,
  formatUsdCompact,
} from '../_lib/angle-workspace-helpers';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import type { RecentAngleJobEntry } from '../_lib/angle-workspace-types';
import { AngleOutputMosaic } from './angle-output-mosaic';

export function AngleOutputPanel({
  copy,
  generating,
  locale,
  onAddOutputToLibrary,
  onRecentJobOpen,
  onRecentOutputIndexReset,
  onSelectedOutputIndexChange,
  recentAngleJobs,
  result,
  savingOutputUrl,
  selectedOutputIndex,
  showGuestExampleOutput,
}: {
  copy: AngleCopy;
  generating: boolean;
  locale: string;
  onAddOutputToLibrary: (url: string) => void;
  onRecentJobOpen: (jobId: string) => void;
  onRecentOutputIndexReset: () => void;
  onSelectedOutputIndexChange: (index: number) => void;
  recentAngleJobs: RecentAngleJobEntry[];
  result: AngleToolResponse | null;
  savingOutputUrl: string | null;
  selectedOutputIndex: number;
  showGuestExampleOutput: boolean;
}) {
  const selectedOutput = result?.outputs[selectedOutputIndex] ?? null;

  return (
    <Card className="border border-border bg-surface p-5">
      <div className="flex h-full flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.output}</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">{copy.outputTitle}</h2>
        </div>

        {selectedOutput ? (
          <>
            <div className="relative">
              <AngleOutputMosaic
                outputs={(result?.outputs ?? []).map((output) => ({ url: output.url, thumbUrl: output.thumbUrl ?? output.url }))}
                selectedIndex={selectedOutputIndex}
                onSelect={onSelectedOutputIndexChange}
                onDownload={(url) => triggerAppDownload(url, suggestDownloadFilename(url, `angle-preview-${Date.now()}`))}
                onAddToLibrary={(url) => onAddOutputToLibrary(url)}
                libraryDisabled={Boolean(selectedOutput?.persisted) || Boolean(savingOutputUrl)}
                copy={copy}
              />

              {generating ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-card bg-surface-on-media-dark-45 backdrop-blur-[2px]">
                  <div className="rounded-card border border-white/20 bg-surface-on-media-dark-55 px-4 py-3 text-center text-on-inverse shadow-card">
                    <div className="flex items-center justify-center gap-2 text-sm font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {copy.generatingOverlayTitle}
                    </div>
                    <p className="mt-1 text-xs text-on-inverse/80">{copy.generatingOverlayBody}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-card border border-border bg-bg p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span>{copy.latency}: {result?.latencyMs ?? 0} ms</span>
                <span>·</span>
                <span>{formatUsdCompact(result?.pricing.actualCostUsd ?? result?.pricing.estimatedCostUsd ?? null)}</span>
              </div>
              {result?.applied.safeApplied ? (
                <p className="mt-2 text-xs text-warning">{copy.safeGuardrails}</p>
              ) : null}
            </div>
          </>
        ) : showGuestExampleOutput ? (
          <div className="overflow-hidden rounded-card border border-border bg-bg">
            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(15,23,42,0.06))]">
              <img src={ANGLE_GUEST_EXAMPLE_OUTPUT_URL} alt="" className="max-h-[420px] w-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center rounded-card border border-dashed border-border bg-bg p-6 text-center">
            <div>
              {generating ? (
                <>
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {copy.generatingOverlayTitle}
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    {copy.generatingOverlayBody}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-text-primary">{copy.emptyTitle}</p>
                  <p className="mt-2 text-xs text-text-muted">{copy.emptyBody}</p>
                </>
              )}
            </div>
          </div>
        )}

        {recentAngleJobs.length ? (
          <div className="rounded-card border border-border bg-bg p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.previousJobs}</p>
              <Link href="/jobs" className="text-xs font-medium text-brand hover:underline">
                {copy.openJobs}
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {recentAngleJobs.map((entry) => (
                <button
                  key={entry.jobId}
                  type="button"
                  onClick={() => {
                    onRecentJobOpen(entry.jobId);
                    onRecentOutputIndexReset();
                  }}
                  className="overflow-hidden rounded-card border border-border bg-surface text-left transition hover:border-brand/40"
                >
                  <div className="h-20 w-full overflow-hidden bg-bg">
                    <AngleOutputMosaic outputs={entry.outputs} compact copy={copy} />
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[10px] font-medium text-text-primary">{entry.engineLabel}</p>
                    <p className="truncate text-[10px] text-text-muted">
                      {new Date(entry.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
