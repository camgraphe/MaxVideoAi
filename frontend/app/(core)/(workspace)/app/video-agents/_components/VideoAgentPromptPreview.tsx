'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatVideoAgentPrice } from '../_lib/video-agent-config';
import type { VideoAgentPrototypeResult } from '../_lib/video-agent-state';

type VideoAgentPromptPreviewProps = {
  result: VideoAgentPrototypeResult;
};

export function VideoAgentPromptPreview({ result }: VideoAgentPromptPreviewProps) {
  const [copied, setCopied] = useState(false);
  const settingsRows = [
    ['Engine', result.settings.engineLabel],
    ['Mode', result.mode],
    ['Duration', `${result.settings.durationSec}s`],
    ['Format', result.settings.aspectRatio],
    ['Resolution', result.settings.resolution],
    ['Audio', result.settings.audioEnabled ? 'on' : 'off'],
    ['Estimate', formatVideoAgentPrice(result.settings.estimatedPriceCents)],
    ['Image engine', result.imageEngine ?? 'none in V1'],
  ];

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(result.finalPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex h-full min-h-0 w-full max-w-3xl flex-col rounded-[8px] border border-border bg-bg text-left">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Final Seedance prompt</p>
          <p className="text-xs text-text-muted">Manual test package. No provider call was made.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border px-3 text-xs font-medium text-text-primary transition hover:border-text-muted"
          onClick={copyPrompt}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <dl className="grid grid-cols-2 gap-2 text-xs text-text-muted md:grid-cols-4">
          {settingsRows.map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-border bg-surface px-3 py-2">
              <dt>{label}</dt>
              <dd className="mt-1 font-semibold text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Scenario beats</p>
          <div className="mt-2 space-y-2">
            {result.structuredScenario.timeline.map((beat) => (
              <div key={beat.timeRange} className="rounded-[8px] border border-border bg-surface px-3 py-2">
                <p className="text-xs font-semibold text-text-primary">
                  {beat.timeRange} - {beat.beat}
                </p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{beat.visualAction}</p>
              </div>
            ))}
          </div>
        </div>

        <pre className="mt-4 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-[8px] border border-border bg-surface px-3 py-3 text-xs leading-5 text-text-primary">
          {result.finalPrompt}
        </pre>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Avoid</p>
            <ul className="mt-2 space-y-1 text-xs text-text-secondary">
              {result.negativePromptOrAvoid.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Reviewer</p>
            <ul className="mt-2 space-y-1 text-xs text-text-secondary">
              <li>- Duration fit: {result.reviewChecklist.fitsSelectedDuration ? 'yes' : 'no'}</li>
              <li>- Seedance structure: {result.reviewChecklist.usesSeedanceFriendlyStructure ? 'yes' : 'no'}</li>
              <li>- Short CTA: {result.reviewChecklist.hasShortCTA ? 'yes' : 'no'}</li>
              <li>- Safe content: {result.reviewChecklist.avoidsUnsafeContent ? 'yes' : 'no'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
