import { Button } from '@/components/ui/Button';
import type { ComposerProps } from './composer-types';

type ComposerMultiPromptEditorProps = {
  multiPrompt: NonNullable<ComposerProps['multiPrompt']>;
};

export function ComposerMultiPromptEditor({ multiPrompt }: ComposerMultiPromptEditorProps) {
  return (
    <div className="space-y-3 px-4 pb-4">
      {multiPrompt.scenes.map((scene, index) => {
        const maxPromptChars = multiPrompt.maxPromptChars;
        const promptOverLimit =
          typeof maxPromptChars === 'number' && scene.prompt.length > maxPromptChars;

        return (
          <div
            key={scene.id}
            className="rounded-input border border-border bg-surface p-3 text-sm text-text-secondary dark:border-white/8 dark:bg-white/[0.04] dark:text-white/72"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] uppercase tracking-micro text-text-muted">Scene {index + 1}</span>
              {multiPrompt.scenes.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => multiPrompt.onRemoveScene(scene.id)}
                  className="min-h-0 h-auto px-2 py-1 text-[11px]"
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <textarea
              value={scene.prompt}
              maxLength={maxPromptChars}
              onChange={(event) => multiPrompt.onUpdateScene(scene.id, { prompt: event.currentTarget.value })}
              placeholder={`Scene ${index + 1} prompt`}
              rows={3}
              className={`mt-2 w-full rounded-input border bg-surface px-3 py-2 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/35 ${
                promptOverLimit ? 'border-error-border' : 'border-border dark:border-white/8'
              }`}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-text-muted">
              <div className="flex items-center gap-2">
                <span>Duration (s)</span>
                <input
                  type="number"
                  min={multiPrompt.minDurationSec}
                  max={multiPrompt.maxDurationSec}
                  value={scene.duration}
                  onChange={(event) =>
                    multiPrompt.onUpdateScene(scene.id, {
                      duration: Math.max(0, Math.round(Number(event.currentTarget.value))),
                    })
                  }
                  className="w-20 rounded-input border border-border bg-surface px-2 py-1 text-right text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/8 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              {typeof maxPromptChars === 'number' ? (
                <span className={promptOverLimit ? 'text-error' : undefined}>
                  {scene.prompt.length}/{maxPromptChars}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-text-muted">
        <span>
          Total: {multiPrompt.totalDurationSec}s · Min {multiPrompt.minDurationSec}s · Max {multiPrompt.maxDurationSec}s
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={multiPrompt.onAddScene}
          className="min-h-0 h-auto rounded-full px-3 py-1.5 text-[11px] uppercase tracking-micro"
        >
          + Scene
        </Button>
      </div>
      {multiPrompt.error ? (
        <div className="rounded-input border border-error-border bg-error-bg px-3 py-2 text-[12px] text-error">
          {multiPrompt.error}
        </div>
      ) : null}
    </div>
  );
}
