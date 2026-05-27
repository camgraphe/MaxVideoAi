import type {
  PromptIntelligenceReviewCandidate,
} from '@/server/prompt-intelligence';
import {
  formatPromptReviewLabel,
  formatPromptReviewScore,
  reviewIntents,
  reviewVerdicts,
} from '../_lib/prompt-intelligence-format';

type ReviewAction = (formData: FormData) => Promise<void>;

type PromptIntelligenceReviewFormProps = {
  candidate: PromptIntelligenceReviewCandidate;
  reviewAction: ReviewAction;
};

const quickIssueOptions = [
  'prompt_too_vague',
  'prompt_too_complex',
  'wrong_model',
  'wrong_workflow',
  'duration_mismatch',
  'reference_issue',
  'text_logo_drift',
  'identity_drift',
  'weak_motion',
  'audio_lipsync_issue',
  'model_limitation',
];

const nextActionOptions = [
  'use_as_example',
  'use_as_template',
  'create_seo_candidate',
  'improve_prompt',
  'retry_other_model',
  'retry_other_workflow',
  'add_starting_image',
  'add_text_overlay',
  'avoid_this_pattern',
  'do_not_recommend_route',
];

export function PromptIntelligenceReviewForm({
  candidate,
  reviewAction,
}: PromptIntelligenceReviewFormProps) {
  const { summary, review, signals } = candidate;
  const adaptive = new Set(signals.adaptiveScoreKeys);

  return (
    <form action={reviewAction} className="space-y-5">
      <input type="hidden" name="jobId" value={summary.jobId} />
      <input type="hidden" name="promptStructureVersion" value={review?.promptStructureVersion ?? ''} />
      <input type="hidden" name="strategistVersion" value={review?.strategistVersion ?? ''} />
      <input type="hidden" name="modelCatalogVersion" value={review?.modelCatalogVersion ?? ''} />

      <section className="rounded-2xl border border-hairline bg-bg/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Quick review</p>
            <h3 className="mt-1 text-base font-semibold text-text-primary">Prompt compared with final render</h3>
          </div>
          <div className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">
            Existing score: {formatPromptReviewScore(review?.overallScore)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ScoreSelect label="Overall result" name="overallScore" defaultValue={review?.overallScore} />
          <ScoreSelect label="Prompt match" name="promptMatchScore" defaultValue={review?.promptMatchScore} />
          <ScoreSelect label="Model fit" name="modelFitScore" defaultValue={review?.modelFitScore} />
          <ScoreSelect label="Workflow fit" name="workflowFitScore" defaultValue={review?.workflowFitScore} />
          <ScoreSelect label="Visual quality" name="visualQualityScore" defaultValue={review?.visualQualityScore} />
          <ScoreSelect label="Motion" name="motionScore" defaultValue={review?.motionScore} />
          <ScoreSelect label="Camera" name="cameraScore" defaultValue={review?.cameraScore} />
          <ScoreSelect label="Commercial use" name="commercialUseScore" defaultValue={review?.commercialUseScore} />
          <ScoreSelect label="SEO potential" name="seoPotentialScore" defaultValue={review?.seoPotentialScore} />
          {adaptive.has('productPreservationScore') ? (
            <ScoreSelect label="Product preservation" name="productPreservationScore" defaultValue={review?.productPreservationScore} />
          ) : null}
          {adaptive.has('characterPreservationScore') ? (
            <ScoreSelect label="Character preservation" name="characterPreservationScore" defaultValue={review?.characterPreservationScore} />
          ) : null}
          {adaptive.has('textLogoAccuracyScore') ? (
            <ScoreSelect label="Text/logo accuracy" name="textLogoAccuracyScore" defaultValue={review?.textLogoAccuracyScore} />
          ) : null}
          {adaptive.has('audioLipSyncScore') ? (
            <ScoreSelect label="Audio/lip-sync" name="audioLipSyncScore" defaultValue={review?.audioLipSyncScore} />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-hairline bg-surface p-4 xl:grid-cols-2">
        <SelectField label="Intent" name="intent" defaultValue={review?.intent ?? summary.intent} options={reviewIntents} />
        <SelectField label="Verdict" name="verdict" defaultValue={review?.verdict ?? 'good_needs_prompt_tweak'} options={reviewVerdicts} />
        <SelectField label="Main issue" name="mainIssue" defaultValue={fieldFromReview(review, 'mainIssue')} options={quickIssueOptions} allowEmpty />
        <SelectField label="Next action" name="nextAction" defaultValue={fieldFromReview(review, 'nextAction')} options={nextActionOptions} allowEmpty />
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
          Prompt source
          <select
            name="promptSource"
            defaultValue={review?.promptSource ?? 'manual'}
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary"
          >
            {['manual', 'ai_strategist', 'prompt_improver', 'template', 'admin', 'unknown'].map((source) => (
              <option key={source} value={source}>
                {formatPromptReviewLabel(source)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
          Prompt structure id
          <input
            name="promptStructureId"
            defaultValue={review?.promptStructureId ?? ''}
            placeholder="product-ad / seedance-t2v / kling-i2v"
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border border-hairline bg-bg/40 p-4 xl:grid-cols-2">
        <TextAreaField label="Blockers" name="blockers" defaultValue={review?.blockers.join('\n') ?? ''} placeholder="text drift, identity drift, weak first shot" />
        <TextAreaField
          label="Improvement suggestions"
          name="improvementSuggestions"
          defaultValue={review?.improvementSuggestions.join('\n') ?? ''}
          placeholder="Use starting image first, shorten dialogue, switch workflow..."
        />
        <TextAreaField
          label="Avoid pattern summary"
          name="avoidPatternSummary"
          defaultValue={review?.avoidPatternSummary ?? ''}
          placeholder="What should the agent avoid next time?"
        />
        <TextAreaField label="Reviewer notes" name="notes" defaultValue={review?.notes ?? ''} placeholder="Internal context for future prompt tuning." />
        <label className="xl:col-span-2 flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
          Tags
          <input
            name="tags"
            defaultValue={(review?.tags.length ? review.tags : signals.suggestedTags).join(', ')}
            placeholder="product, text-logo-risk, strong-hook"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
          />
        </label>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input type="checkbox" name="createPattern" className="h-4 w-4 rounded border-border" />
          Also create a Best / Avoid pattern from this review
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="reviewDepth" value="adaptive" />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-sm">
            Save and next
          </button>
        </div>
      </section>
    </form>
  );
}

function ScoreSelect({ label, name, defaultValue }: { label: string; name: string; defaultValue?: number | null }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary"
      >
        <option value="">Not scored</option>
        {[1, 2, 3, 4, 5].map((score) => (
          <option key={score} value={score}>
            {score} / 5
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  allowEmpty = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: string[];
  allowEmpty?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary"
      >
        {allowEmpty ? <option value="">No selection</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {formatPromptReviewLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={3}
        className="min-h-24 rounded-xl border border-border bg-surface px-3 py-2 text-sm leading-6 text-text-primary placeholder:text-text-muted"
      />
    </label>
  );
}

function fieldFromReview(review: PromptIntelligenceReviewCandidate['review'], key: string): string | null {
  const value = review?.qcmAnswersJson?.[key];
  return typeof value === 'string' ? value : null;
}
