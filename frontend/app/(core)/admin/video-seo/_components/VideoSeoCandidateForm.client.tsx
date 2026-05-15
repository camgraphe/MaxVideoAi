'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';

export function VideoSeoCandidateForm() {
  const router = useRouter();
  const [videoId, setVideoId] = useState('');
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanVideoId = videoId.trim();
    if (!cleanVideoId) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await authFetch('/api/admin/video-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: cleanVideoId }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to create SEO candidate');
      }
      setVideoId('');
      setMessage('Draft candidate created. Complete the editorial fields before approval.');
      startTransition(() => router.refresh());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create SEO candidate');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
      <label className="min-w-0 flex-1 text-sm font-medium text-text-primary">
        Video ID
        <input
          value={videoId}
          onChange={(event) => setVideoId(event.currentTarget.value)}
          placeholder="job_..."
          className="mt-1 w-full rounded-input border border-hairline bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none transition focus:border-border-hover focus:ring-2 focus:ring-ring/30"
        />
      </label>
      <Button type="submit" size="md" disabled={saving || pending || !videoId.trim()}>
        {saving || pending ? 'Creating...' : 'Create draft'}
      </Button>
      <div className="min-h-5 text-sm">
        {message ? <p className="font-medium text-success">{message}</p> : null}
        {error ? <p className="font-medium text-error">{error}</p> : null}
      </div>
    </form>
  );
}
