'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';

type ServiceNoticeFormProps = {
  initialNotice: {
    enabled: boolean;
    message: string;
  };
  embedded?: boolean;
  className?: string;
};

export function ServiceNoticeForm({ initialNotice, embedded = false, className }: ServiceNoticeFormProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialNotice.enabled);
  const [message, setMessage] = useState(initialNotice.message);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      enabled,
      message: message.trim(),
    };
    startTransition(async () => {
      setStatus('idle');
      setError(null);
      try {
        const response = await fetch('/api/admin/service-notice', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? 'Could not save the service notice.');
        }
        setStatus('success');
        router.refresh();
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Could not save the service notice.');
      }
    });
  };

  const disableNotice = () => {
    startTransition(async () => {
      setStatus('idle');
      setError(null);
      try {
        const response = await fetch('/api/admin/service-notice', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false, message: '' }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? 'Could not disable the service notice.');
        }
        setEnabled(false);
        setMessage('');
        setStatus('success');
        router.refresh();
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Could not disable the service notice.');
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(
        embedded ? 'space-y-4' : 'space-y-4 rounded-card border border-border bg-surface p-6 shadow-card',
        className
      )}
    >
      {!embedded ? (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-text-primary">Service notice</h2>
          <p className="text-sm text-text-secondary">
            Show a message across the workspace when an incident affects members.
          </p>
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-brand focus:ring-ring"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Show the notice in the workspace
      </label>
      <div className="space-y-2">
        <label htmlFor="service-notice-message" className="text-xs font-semibold uppercase tracking-micro text-text-muted">
          Message
        </label>
        <textarea
          id="service-notice-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!enabled}
          rows={3}
          maxLength={500}
          className="w-full rounded-input border border-border bg-surface-glass-80 px-3 py-2 text-sm text-text-primary shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted/40"
          placeholder="Some providers are experiencing an issue. New renders may be delayed."
        />
        <p className="text-xs text-text-muted">Maximum 500 characters. Add a message before enabling the notice.</p>
      </div>
      {status === 'success' ? (
        <div className="rounded-input border border-state-success/40 bg-state-success/10 px-3 py-2 text-sm text-state-success">
          Service notice updated.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-input border border-state-warning/40 bg-state-warning/10 px-3 py-2 text-sm text-state-warning">{error}</div>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          size="sm"
          disabled={isPending || (enabled && !message.trim())}
          className={clsx(
            'bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brandHover',
            embedded ? 'rounded-xl' : 'rounded-full shadow-card'
          )}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={disableNotice}
          disabled={isPending}
          className="min-h-0 h-auto p-0 text-sm font-semibold text-text-secondary underline-offset-2 hover:text-text-primary"
        >
          Disable
        </Button>
      </div>
    </form>
  );
}
