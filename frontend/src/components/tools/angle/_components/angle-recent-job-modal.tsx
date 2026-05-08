/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import type { RecentAngleJobEntry } from '../_lib/angle-workspace-types';
import { AngleOutputMosaic } from './angle-output-mosaic';

export function AngleRecentJobModal({
  copy,
  job,
  locale,
  onAddToLibrary,
  onClose,
  onOutputIndexChange,
  outputIndex,
  savingOutputUrl,
}: {
  copy: AngleCopy;
  job: RecentAngleJobEntry | null;
  locale: string;
  onAddToLibrary: (url: string, jobId: string) => void;
  onClose: () => void;
  onOutputIndexChange: (index: number) => void;
  outputIndex: number;
  savingOutputUrl: string | null;
}) {
  if (!job) return null;

  const activeOutput = job.outputs[outputIndex] ?? job.outputs[0] ?? null;

  return (
    <div
      className="fixed inset-0 z-[10040] flex items-center justify-center bg-surface-on-media-dark-60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-modal border border-border bg-surface shadow-float">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.angleJob}</p>
            <h3 className="mt-1 text-lg font-semibold text-text-primary">{job.engineLabel}</h3>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {copy.close}
          </Button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
          {job.outputs.length > 1 ? (
            <>
              <AngleOutputMosaic
                outputs={job.outputs}
                selectedIndex={outputIndex}
                onSelect={onOutputIndexChange}
                onDownload={(url) => triggerAppDownload(url, suggestDownloadFilename(url, `angle-job-${Date.now()}`))}
                onAddToLibrary={(url) => onAddToLibrary(url, job.jobId)}
                libraryDisabled={Boolean(savingOutputUrl)}
                singleRow
                copy={copy}
              />
              {activeOutput ? (
                <RecentJobOutputPreview
                  copy={copy}
                  jobId={job.jobId}
                  onAddToLibrary={onAddToLibrary}
                  outputUrl={activeOutput.url}
                  savingOutputUrl={savingOutputUrl}
                  tall
                />
              ) : null}
            </>
          ) : activeOutput ? (
            <RecentJobOutputPreview
              copy={copy}
              jobId={job.jobId}
              onAddToLibrary={onAddToLibrary}
              outputUrl={activeOutput.url}
              savingOutputUrl={savingOutputUrl}
            />
          ) : null}
          <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
            <span>{new Date(job.createdAt).toLocaleString(locale)}</span>
            <Link href="/jobs" className="font-medium text-brand hover:underline">
              {copy.openJobs}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentJobOutputPreview({
  copy,
  jobId,
  onAddToLibrary,
  outputUrl,
  savingOutputUrl,
  tall = false,
}: {
  copy: AngleCopy;
  jobId: string;
  onAddToLibrary: (url: string, jobId: string) => void;
  outputUrl: string;
  savingOutputUrl: string | null;
  tall?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-bg">
      <img src={outputUrl} alt="" className={`${tall ? 'max-h-[48vh]' : 'max-h-[60vh]'} w-full object-contain`} />
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <button
          type="button"
          title={copy.addToLibrary}
          onClick={() => onAddToLibrary(outputUrl, jobId)}
          disabled={Boolean(savingOutputUrl)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-55 text-on-inverse transition hover:bg-surface-on-media-dark-70 disabled:cursor-default disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={copy.download}
          onClick={() => triggerAppDownload(outputUrl, suggestDownloadFilename(outputUrl, `angle-job-${Date.now()}`))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-55 text-on-inverse transition hover:bg-surface-on-media-dark-70"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
