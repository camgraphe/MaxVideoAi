'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type ManualCreditFormProps = {
  userId: string;
};

export function ManualCreditForm({ userId }: ManualCreditFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setStatus({ variant: 'error', message: 'Enter a valid USD amount greater than zero.' });
      return;
    }
    const amountCents = Math.round(parsedAmount * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setStatus({ variant: 'error', message: 'Amount must be at least $0.01.' });
      return;
    }
    const normalizedNote = note.trim();
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, note: normalizedNote.length ? normalizedNote : undefined }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Manual credit failed.');
      }
      setStatus({ variant: 'success', message: 'Credits added successfully.' });
      setAmount('');
      setNote('');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Manual credit failed.';
      setStatus({ variant: 'error', message });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stack-gap-sm rounded-2xl border border-border/70 bg-white p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Manual credit</p>
        <p className="text-sm text-text-secondary">Add wallet balance for debugging or refunds.</p>
      </div>
      <div className="grid grid-gap-sm md:grid-cols-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Amount (USD)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border/60 bg-bg px-3 py-2 text-sm text-text-primary focus:border-ring focus:outline-none"
            required
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Note
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Reason (optional)"
            className="mt-1 w-full rounded-lg border border-border/60 bg-bg px-3 py-2 text-sm text-text-primary focus:border-ring focus:outline-none"
          />
        </label>
      </div>
      {status ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            status.variant === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-600'
          }`}
        >
          {status.message}
        </div>
      ) : null}
      <div className="flex items-center gap-4">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="rounded-full bg-text-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
        >
          {pending ? 'Processing…' : 'Add credits'}
        </Button>
        <span className="text-xs text-text-secondary">Posts to /api/admin/users/{userId}/wallet</span>
      </div>
    </form>
  );
}
