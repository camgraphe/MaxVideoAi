'use client';

import { useState, useTransition } from 'react';

type ServiceNoticeFormProps = {
  initialNotice: {
    enabled: boolean;
    message: string;
  };
};

export function ServiceNoticeForm({ initialNotice }: ServiceNoticeFormProps) {
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
          throw new Error(data?.error ?? 'Impossible de sauvegarder la bannière.');
        }
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Impossible de sauvegarder la bannière.');
      }
    });
  };

  const disableNotice = () => {
    setEnabled(false);
    setMessage('');
    startTransition(async () => {
      setStatus('idle');
      setError(null);
      try {
        await fetch('/api/admin/service-notice', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false, message: '' }),
        });
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Impossible de désactiver la bannière.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-border bg-white p-6 shadow-card">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">Bannière de service</h2>
        <p className="text-sm text-text-secondary">
          Affiche un message global dans le dashboard pour prévenir les utilisateurs des incidents en cours.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Afficher la bannière dans le dashboard
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
          className="w-full rounded-input border border-border bg-white/80 px-3 py-2 text-sm text-text-primary shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted/40"
          placeholder="Ex : Certains fournisseurs rencontrent un incident. Les nouveaux rendus sont temporairement retardés."
        />
        <p className="text-xs text-text-muted">Max 500 caractères. Le message doit être renseigné pour activer la bannière.</p>
      </div>
      {status === 'success' ? (
        <div className="rounded-input border border-state-success/40 bg-state-success/10 px-3 py-2 text-sm text-state-success">
          Bannière mise à jour.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-input border border-state-warning/40 bg-state-warning/10 px-3 py-2 text-sm text-state-warning">{error}</div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending || (enabled && !message.trim())}
          className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={disableNotice}
          disabled={isPending}
          className="text-sm font-semibold text-text-secondary underline-offset-2 transition hover:text-text-primary"
        >
          Désactiver
        </button>
      </div>
    </form>
  );
}
