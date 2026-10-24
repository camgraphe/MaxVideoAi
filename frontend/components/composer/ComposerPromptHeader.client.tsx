'use client';

import clsx from 'clsx';
import { ComposerPromptClear } from './ComposerPromptClear.client';

export function ComposerPromptHeader({ promptId, promptLabel, prompt, onPromptChange, promptMaxChars, promptTooLong, multiPromptEnabled, locale }: {
  promptId: string;
  promptLabel: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  promptMaxChars?: number;
  promptTooLong: boolean;
  multiPromptEnabled: boolean;
  locale: string;
}) {
  return <div className="flex w-full items-center justify-between gap-2">
    <div className="flex min-w-0 items-center gap-2">
      {multiPromptEnabled
        ? <h2 id={`${promptId}-heading`} className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{promptLabel}</h2>
        : <label htmlFor={promptId} className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{promptLabel}</label>}
      {typeof promptMaxChars === 'number' ? (
        <div className={clsx('text-[12px]', promptTooLong ? 'text-error' : 'text-text-muted')}>
          {prompt.length}/{promptMaxChars}
        </div>
      ) : null}
    </div>
    {!multiPromptEnabled ? <ComposerPromptClear prompt={prompt} onPromptChange={onPromptChange} inputId={promptId} locale={locale} /> : null}
  </div>;
}
