'use client';

import { useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import type { VideoSeoEditorialEntry, VideoSeoIntent, VideoSeoStatus } from '@/config/video-seo-editorial';

type VideoSeoEditorialEditorProps = {
  editorial: VideoSeoEditorialEntry;
};

const SEO_STATUSES: VideoSeoStatus[] = ['candidate', 'draft', 'needs_edits', 'approved', 'disabled'];
const SEO_INTENTS: VideoSeoIntent[] = ['prompt-example', 'model-demo', 'product-ad', 'camera-motion', 'image-to-video', 'audio-enabled'];

export function VideoSeoEditorialEditor({ editorial }: VideoSeoEditorialEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<VideoSeoEditorialEntry>(editorial);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canonicalSlugUnlocked, setCanonicalSlugUnlocked] = useState(false);
  const [confirmCanonicalSlugChange, setConfirmCanonicalSlugChange] = useState(false);
  const existingCanonicalSlug = editorial.canonicalSlug?.trim() ?? '';
  const draftCanonicalSlug = draft.canonicalSlug?.trim() ?? '';
  const hasExistingCanonicalSlug = existingCanonicalSlug.length > 0;
  const canonicalSlugChanged = hasExistingCanonicalSlug && draftCanonicalSlug !== existingCanonicalSlug;

  function updateField(field: keyof VideoSeoEditorialEntry, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    if (canonicalSlugChanged && (!canonicalSlugUnlocked || !confirmCanonicalSlugChange)) {
      setSaving(false);
      setError('Canonical slug is locked. Unlock it and confirm the canonical URL change before saving.');
      return;
    }

    try {
      const response = await authFetch(`/api/admin/video-seo/${encodeURIComponent(draft.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          allowCanonicalSlugChange: canonicalSlugChanged && canonicalSlugUnlocked && confirmCanonicalSlugChange,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to save editorial page');
      }
      if (json.editorial) {
        setDraft(json.editorial);
        setCanonicalSlugUnlocked(false);
        setConfirmCanonicalSlugChange(false);
      }
      setMessage('Editorial page saved. Sitemap inclusion will still depend on QA.');
      startTransition(() => router.refresh());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save editorial page');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="SEO status"
          value={draft.seoStatus}
          options={SEO_STATUSES}
          onChange={(event) => updateField('seoStatus', event.currentTarget.value)}
        />
        <SelectField
          label="Intent"
          value={draft.intent}
          options={SEO_INTENTS}
          onChange={(event) => updateField('intent', event.currentTarget.value)}
        />
        <TextField label="Target keyword" value={draft.targetKeyword} onChange={(value) => updateField('targetKeyword', value)} />
        <TextField label="Model slug" value={draft.modelSlug} onChange={(value) => updateField('modelSlug', value)} />
        <TextField label="Examples slug" value={draft.examplesSlug} onChange={(value) => updateField('examplesSlug', value)} />
        <div className="md:col-span-2">
          <TextField
            label="Canonical slug"
            value={draft.canonicalSlug ?? ''}
            disabled={hasExistingCanonicalSlug && !canonicalSlugUnlocked}
            onChange={(value) => updateField('canonicalSlug', value)}
          />
          {hasExistingCanonicalSlug ? (
            <div className="mt-2 space-y-2 rounded-input border border-hairline bg-bg/60 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-text-muted">
                  Existing slug is locked to avoid accidental canonical URL changes.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCanonicalSlugUnlocked((current) => !current);
                    setConfirmCanonicalSlugChange(false);
                  }}
                  className="text-xs font-semibold text-text-primary underline-offset-2 hover:underline"
                >
                  {canonicalSlugUnlocked ? 'Lock slug' : 'Unlock slug'}
                </button>
              </div>
              {canonicalSlugUnlocked ? (
                <label className="flex items-start gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={confirmCanonicalSlugChange}
                    onChange={(event) => setConfirmCanonicalSlugChange(event.currentTarget.checked)}
                    className="mt-0.5"
                  />
                  <span>I confirm this may change the indexed canonical URL and require Google to recrawl the video page.</span>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
        <TextField label="VideoObject.name" value={draft.videoObjectName} onChange={(value) => updateField('videoObjectName', value)} />
      </div>
      <TextField label="SEO title" value={draft.seoTitle} onChange={(value) => updateField('seoTitle', value)} />
      <TextField label="H1" value={draft.h1} onChange={(value) => updateField('h1', value)} />
      <TextareaField label="Meta description" value={draft.metaDescription} onChange={(value) => updateField('metaDescription', value)} rows={3} />
      <TextareaField label="Short description" value={draft.shortDescription} onChange={(value) => updateField('shortDescription', value)} rows={4} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={saving || pending}>
          {saving || pending ? 'Saving...' : 'Save editorial page'}
        </Button>
        {message ? <p className="text-sm font-medium text-success">{message}</p> : null}
        {error ? <p className="text-sm font-medium text-error">{error}</p> : null}
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm normal-case tracking-normal text-text-primary outline-none transition focus:border-border-hover focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-1 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm normal-case tracking-normal text-text-primary outline-none transition focus:border-border-hover focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}

function SelectField<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: readonly TValue[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
      {label}
      <select
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm normal-case tracking-normal text-text-primary outline-none transition focus:border-border-hover focus:ring-2 focus:ring-ring/30"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
