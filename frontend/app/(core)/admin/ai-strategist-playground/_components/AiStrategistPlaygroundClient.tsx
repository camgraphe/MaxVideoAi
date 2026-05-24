'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Send, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import type {
  AiStrategistPlaygroundInput,
  AiStrategistPlaygroundMode,
  AiStrategistPlaygroundResult,
} from '@/lib/ai-strategist/playground-pipeline';
import type { AiStrategistModelId, AiStrategistRecommendation, AiStrategistWorkflowId } from '@/lib/ai-strategist/types';

type SelectOption<TValue extends string> = {
  id: TValue;
  label: string;
};

type AiStrategistPlaygroundClientProps = {
  modelOptions: SelectOption<AiStrategistModelId>[];
  workflowOptions: SelectOption<AiStrategistWorkflowId>[];
};

type UploadedAssetState = NonNullable<AiStrategistPlaygroundInput['uploadedAsset']>;

const modeOptions: SelectOption<AiStrategistPlaygroundMode>[] = [
  { id: 'recommend', label: 'Recommend' },
  { id: 'build_prompt', label: 'Build prompt' },
  { id: 'improve_prompt', label: 'Improve prompt' },
  { id: 'product_help', label: 'Product help' },
];

const uploadedAssetToggles: { key: keyof UploadedAssetState; label: string }[] = [
  { key: 'hasPerson', label: 'hasPerson' },
  { key: 'hasProduct', label: 'hasProduct' },
  { key: 'hasLogo', label: 'hasLogo' },
  { key: 'hasText', label: 'hasText' },
  { key: 'isReferenceImage', label: 'isReferenceImage' },
];

const initialAsset: UploadedAssetState = {
  type: 'image',
  hasPerson: false,
  hasProduct: false,
  hasLogo: false,
  hasText: false,
  isReferenceImage: false,
};

export function AiStrategistPlaygroundClient({
  modelOptions,
  workflowOptions,
}: AiStrategistPlaygroundClientProps) {
  const [userMessage, setUserMessage] = useState('Social-first sneaker ad with voiceover, vertical');
  const [mode, setMode] = useState<AiStrategistPlaygroundMode>('recommend');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [uploadedAsset, setUploadedAsset] = useState<UploadedAssetState>(initialAsset);
  const [result, setResult] = useState<AiStrategistPlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAssetMetadata = useMemo(() => {
    const hasAnyAssetFlag = uploadedAsset.hasPerson || uploadedAsset.hasProduct || uploadedAsset.hasLogo || uploadedAsset.hasText || uploadedAsset.isReferenceImage;
    return hasAnyAssetFlag ? uploadedAsset : undefined;
  }, [uploadedAsset]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload: AiStrategistPlaygroundInput = {
      userMessage,
      mode,
      ...(currentPrompt.trim() ? { currentPrompt: currentPrompt.trim() } : {}),
      ...(selectedModel ? { selectedModel: selectedModel as AiStrategistModelId } : {}),
      ...(selectedWorkflow ? { selectedWorkflow: selectedWorkflow as AiStrategistWorkflowId } : {}),
      ...(selectedAssetMetadata ? { uploadedAsset: selectedAssetMetadata } : {}),
    };

    try {
      const response = await authFetch('/api/admin/ai-strategist-playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => null)) as AiStrategistPlaygroundResult | { ok?: false; error?: string } | null;
      if (!response.ok || !json?.ok) {
        throw new Error(json && 'error' in json && json.error ? json.error : 'AI Strategist playground request failed');
      }
      setResult(json);
    } catch (submitError) {
      setResult(null);
      setError(submitError instanceof Error ? submitError.message : 'AI Strategist playground request failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateAssetFlag(key: keyof UploadedAssetState, checked: boolean) {
    setUploadedAsset((current) => ({ ...current, [key]: checked }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.4fr)]">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-[20px] border border-border bg-surface px-5 py-5 shadow-card">
        <div className="flex items-start gap-3 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">Dev playground only — does not run generation or spend credits.</p>
        </div>

        <TextAreaField
          id="ai-strategist-user-message"
          label="User message"
          value={userMessage}
          onChange={setUserMessage}
          rows={5}
          placeholder="Luxury perfume ad on black marble, 9:16, premium look"
        />

        <SelectField
          id="ai-strategist-mode"
          label="Mode"
          value={mode}
          options={modeOptions}
          onChange={(value) => setMode(value as AiStrategistPlaygroundMode)}
        />

        <TextAreaField
          id="ai-strategist-current-prompt"
          label="Current prompt"
          value={currentPrompt}
          onChange={setCurrentPrompt}
          rows={4}
          placeholder="Optional existing prompt for improve_prompt mode"
        />

        <SelectField
          id="ai-strategist-selected-model"
          label="Selected model"
          value={selectedModel}
          options={modelOptions}
          onChange={setSelectedModel}
          emptyLabel="No model selected"
        />

        <SelectField
          id="ai-strategist-selected-workflow"
          label="Selected workflow"
          value={selectedWorkflow}
          options={workflowOptions}
          onChange={setSelectedWorkflow}
          emptyLabel="No workflow selected"
        />

        <fieldset className="space-y-3 rounded-xl border border-hairline bg-bg/50 px-4 py-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Uploaded asset metadata
          </legend>
          <label className="grid gap-1 text-sm font-semibold text-text-secondary" htmlFor="ai-strategist-asset-type">
            type
            <input
              id="ai-strategist-asset-type"
              value={uploadedAsset.type ?? ''}
              onChange={(event) => setUploadedAsset((current) => ({ ...current, type: event.currentTarget.value }))}
              className={inputClassName}
              placeholder="image"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {uploadedAssetToggles.map((toggle) => (
              <label key={toggle.key} className="flex min-h-[38px] items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-medium text-text-secondary">
                <input
                  type="checkbox"
                  checked={Boolean(uploadedAsset[toggle.key])}
                  onChange={(event) => updateAssetFlag(toggle.key, event.currentTarget.checked)}
                  className="h-4 w-4 rounded border-hairline text-brand focus:ring-ring"
                />
                {toggle.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" size="md" disabled={isSubmitting || !userMessage.trim()} className="w-full">
          <Send className="h-4 w-4" />
          {isSubmitting ? 'Running preview...' : 'Run strategist preview'}
        </Button>

        {error ? <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm font-medium text-error">{error}</p> : null}
      </form>

      <div className="space-y-4">
        {result ? <PlaygroundOutput result={result} /> : <EmptyOutput />}
      </div>
    </div>
  );
}

function PlaygroundOutput({ result }: { result: AiStrategistPlaygroundResult }) {
  return (
    <>
      <section className="rounded-[20px] border border-border bg-surface px-5 py-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Pipeline status</p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">{result.assistantMessage}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label="Brief LLM" active={result.llm.briefRefinement.used} fallbackReason={result.llm.briefRefinement.fallbackReason} />
            <StatusBadge label="Prompt LLM" active={result.llm.promptWriter.used} fallbackReason={result.llm.promptWriter.fallbackReason} />
            <StatusBadge label="Sanitized" active={result.llm.promptWriter.sanitizerChangedOutput} activeText="changed" inactiveText="unchanged" />
          </div>
        </div>
      </section>

      <OutputPanel title="Normalized brief">
        <JsonBlock value={result.normalizedBrief} />
      </OutputPanel>

      <OutputPanel title="Orchestration plan">
        <JsonBlock value={result.orchestrationPlan} />
      </OutputPanel>

      <OutputPanel title="Knowledge tools and source details">
        <JsonBlock
          value={{
            toolCalls: result.orchestrationPlan.toolCalls,
            costRouting: result.orchestrationPlan.llm,
            knowledgeToolResults: result.knowledgeToolResults ?? [],
            sourcesUsed: result.knowledgeToolResults?.flatMap((toolResult) => toolResult.sources) ?? [],
          }}
        />
      </OutputPanel>

      <OutputPanel title="LLM cost estimate">
        <JsonBlock value={result.llmCost} />
      </OutputPanel>

      {result.recommendations ? (
        <OutputPanel title="Recommendations">
          <div className="grid gap-3 lg:grid-cols-3">
            <RecommendationTier label="Best" recommendation={result.recommendations.best} />
            <RecommendationTier label="Medium" recommendation={result.recommendations.medium} />
            <RecommendationTier label="Value" recommendation={result.recommendations.value} />
          </div>
        </OutputPanel>
      ) : null}

      {result.alsoConsider?.length ? (
        <OutputPanel title="Also consider">
          <div className="grid gap-2">
            {result.alsoConsider.map((entry) => (
              <div key={entry.model.id} className="rounded-xl border border-hairline bg-bg/50 px-4 py-3">
                <p className="text-sm font-semibold text-text-primary">{entry.model.label}</p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">{entry.reason}</p>
              </div>
            ))}
          </div>
        </OutputPanel>
      ) : null}

      <OutputPanel title="Warnings">
        {result.warnings.length ? <ListBlock items={result.warnings} /> : <p className="text-sm text-text-secondary">No warnings.</p>}
      </OutputPanel>

      <OutputPanel title="PromptGenerationContext summary">
        <JsonBlock value={result.promptGenerationContextSummary ?? null} />
      </OutputPanel>

      <OutputPanel title="Raw LLM output">
        <JsonBlock value={result.rawLlmOutput ?? '[not available]'} />
      </OutputPanel>

      <OutputPanel title="Sanitized final output">
        <JsonBlock value={result.sanitizedFinalOutput ?? null} />
      </OutputPanel>

      <OutputPanel title="Validation issues before sanitizer">
        <JsonBlock value={result.validationIssuesBeforeSanitizer} />
      </OutputPanel>

      <OutputPanel title="Validation issues after sanitizer">
        <JsonBlock value={result.validationIssuesAfterSanitizer} />
      </OutputPanel>

      <OutputPanel title="uiActions preview">
        <JsonBlock value={result.uiActions} />
      </OutputPanel>
    </>
  );
}

function EmptyOutput() {
  return (
    <section className="rounded-[20px] border border-dashed border-border bg-surface px-5 py-10 text-center shadow-card">
      <p className="text-sm font-semibold text-text-primary">Run the strategist preview to inspect the full pipeline output.</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">The preview returns routing, model tradeoffs, raw LLM output, sanitized output, validation issues, and uiActions without applying anything.</p>
    </section>
  );
}

function RecommendationTier({
  label,
  recommendation,
}: {
  label: string;
  recommendation: AiStrategistRecommendation;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-bg/50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-text-primary">{recommendation.model.label}</p>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{recommendation.reason}</p>
      {recommendation.warning ? <p className="mt-2 text-xs font-medium text-warning">{recommendation.warning}</p> : null}
      {recommendation.upgradeNote ? <p className="mt-2 text-xs font-medium text-brand">{recommendation.upgradeNote}</p> : null}
    </div>
  );
}

function StatusBadge({
  label,
  active,
  fallbackReason,
  activeText = 'used',
  inactiveText = 'fallback',
}: {
  label: string;
  active: boolean;
  fallbackReason?: string;
  activeText?: string;
  inactiveText?: string;
}) {
  return (
    <span className={active ? activeBadgeClassName : fallbackBadgeClassName}>
      {label}: {active ? activeText : fallbackReason ?? inactiveText}
    </span>
  );
}

function OutputPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-card">
      <header className="border-b border-hairline px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl border border-hairline bg-bg/70 px-4 py-3 font-mono text-xs leading-5 text-text-secondary">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ListBlock({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-text-secondary">
      {items.map((item) => (
        <li key={item} className="rounded-lg border border-hairline bg-bg/50 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-text-secondary" htmlFor={id}>
      {label}
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className={`${inputClassName} min-h-[110px] resize-y leading-6`}
      />
    </label>
  );
}

function SelectField<TValue extends string>({
  id,
  label,
  value,
  options,
  onChange,
  emptyLabel,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectOption<TValue>[];
  onChange: (value: string) => void;
  emptyLabel?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-text-secondary" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={inputClassName}
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const inputClassName =
  'w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm font-medium text-text-primary outline-none transition placeholder:text-text-muted focus:border-border-hover focus:ring-2 focus:ring-ring/30';

const activeBadgeClassName =
  'inline-flex min-h-[30px] items-center rounded-full border border-success-border bg-success-bg px-3 text-xs font-semibold text-success';

const fallbackBadgeClassName =
  'inline-flex min-h-[30px] items-center rounded-full border border-warning-border bg-warning-bg px-3 text-xs font-semibold text-warning';
