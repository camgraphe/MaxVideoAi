'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import type { McpActivityItem } from '@/server/agent-api/activity-history';
import type {
  McpSpendingSettings,
  McpSpendingSettingsUpdate,
} from '@/server/agent-api/spending-limits';

type LimitDraft = {
  noLimit: boolean;
  dollars: string;
};

type Props = {
  initialSettings: McpSpendingSettings | null;
  initialActivity: McpActivityItem[];
  settingsUnavailable: boolean;
  activityUnavailable: boolean;
};

const MAX_CENTS = 2_147_483_647;

function formatCents(value: number | null): LimitDraft {
  return value === null
    ? { noLimit: true, dollars: '' }
    : { noLimit: false, dollars: `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}` };
}

function parseCents(draft: LimitDraft): number | null | undefined {
  if (draft.noLimit) return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(draft.dollars)) return undefined;
  const [whole, fraction = ''] = draft.dollars.split('.');
  const dollars = Number(whole);
  const cents = dollars * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : undefined;
}

function validSettings(value: unknown): value is McpSpendingSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<McpSpendingSettings>;
  const validCents = (amount: unknown) => amount === null
    || (Number.isSafeInteger(amount) && Number(amount) >= 0 && Number(amount) <= MAX_CENTS);
  return typeof candidate.paidGenerationEnabled === 'boolean'
    && validCents(candidate.perGenerationCents)
    && validCents(candidate.dailyCents)
    && validCents(candidate.webApprovalAboveCents)
    && typeof candidate.updatedAt === 'string'
    && Number.isFinite(new Date(candidate.updatedAt).getTime());
}

function MoneyControl({
  id,
  label,
  help,
  draft,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  draft: LimitDraft;
  disabled: boolean;
  onChange(draft: LimitDraft): void;
}) {
  return (
    <fieldset className="rounded-input border border-border bg-surface-2 p-4">
      <legend className="px-1 text-sm font-semibold text-text-primary">{label}</legend>
      <p className="mt-1 text-xs leading-5 text-text-muted">{help}</p>
      <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={draft.noLimit}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, noLimit: event.target.checked })}
          className="h-4 w-4 rounded border-border text-brand focus-visible:ring-ring"
        />
        No limit
      </label>
      <label htmlFor={id} className="mt-3 block text-xs font-medium text-text-secondary">
        Amount in USD
      </label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-muted">$</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={draft.dollars}
          disabled={disabled || draft.noLimit}
          onChange={(event) => onChange({ ...draft, dollars: event.target.value })}
          placeholder="0.00"
          aria-describedby={`${id}-format`}
          className="min-h-11 w-full rounded-input border border-border bg-surface py-2 pl-7 pr-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
      <p id={`${id}-format`} className="mt-1 text-xs text-text-muted">Use no more than two decimal places.</p>
    </fieldset>
  );
}

const toolLabels: Record<McpActivityItem['tool'], string> = {
  prepare_generation: 'Prepare generation',
  confirm_generation: 'Confirm generation',
};

const outcomeLabels: Record<McpActivityItem['outcome'], string> = {
  prepared: 'Prepared',
  expired: 'Expired',
  claimed: 'Payment reserved',
  accepted: 'Accepted',
  failed: 'Failed',
  refunded: 'Refunded',
};

export function McpSpendingControls({
  initialSettings,
  initialActivity,
  settingsUnavailable,
  activityUnavailable,
}: Props) {
  const [enabled, setEnabled] = useState(initialSettings?.paidGenerationEnabled ?? false);
  const [perGeneration, setPerGeneration] = useState(formatCents(initialSettings?.perGenerationCents ?? null));
  const [daily, setDaily] = useState(formatCents(initialSettings?.dailyCents ?? null));
  const [webApproval, setWebApproval] = useState(formatCents(initialSettings?.webApprovalAboveCents ?? null));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  function applySettings(next: McpSpendingSettings) {
    setEnabled(next.paidGenerationEnabled);
    setPerGeneration(formatCents(next.perGenerationCents));
    setDaily(formatCents(next.dailyCents));
    setWebApproval(formatCents(next.webApprovalAboveCents));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !initialSettings) return;
    setNotice(null);
    const perGenerationCents = parseCents(perGeneration);
    const dailyCents = parseCents(daily);
    const webApprovalAboveCents = parseCents(webApproval);
    if (
      perGenerationCents === undefined
      || dailyCents === undefined
      || webApprovalAboveCents === undefined
    ) {
      setNotice({ kind: 'error', message: 'Enter valid USD amounts with no more than two decimal places.' });
      return;
    }
    const body: McpSpendingSettingsUpdate = {
      paidGenerationEnabled: enabled,
      perGenerationCents,
      dailyCents,
      webApprovalAboveCents,
    };
    setSaving(true);
    try {
      const response = await fetch('/api/account/mcp-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      const returned = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as { settings?: unknown }).settings
        : null;
      if (!response.ok || !validSettings(returned)) throw new Error('save_failed');
      applySettings(returned);
      setNotice({ kind: 'success', message: 'Spending controls saved.' });
    } catch {
      setNotice({ kind: 'error', message: 'Unable to save spending controls right now. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="mcp-spending" className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Wallet protection</p>
        <h2 className="mt-2 text-xl font-semibold text-text-primary">Paid generations</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Codex, Claude, or another compatible host may use automatic tool approval. MaxVideoAI cannot override that host setting, but this switch and these limits are always enforced by MaxVideoAI before wallet spending.
        </p>
      </div>

      {settingsUnavailable || !initialSettings ? (
        <p className="mt-5 rounded-input border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Spending controls are unavailable right now. Existing connection management remains available below.
        </p>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={(event) => void save(event)}>
          <label className="flex items-start justify-between gap-4 rounded-input border border-border bg-surface-2 p-4">
            <span>
              <span className="block text-sm font-semibold text-text-primary">Allow paid generations</span>
              <span className="mt-1 block text-xs leading-5 text-text-muted">
                Turn this off to block new wallet charges from every connected host.
              </span>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={(event) => setEnabled(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 rounded border-border text-brand focus-visible:ring-ring"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-3">
            <MoneyControl
              id="mcp-per-generation"
              label="Maximum per generation"
              help="Block a single generation above this amount."
              draft={perGeneration}
              disabled={saving}
              onChange={setPerGeneration}
            />
            <MoneyControl
              id="mcp-daily"
              label="Daily maximum"
              help="Block charges that would take today's UTC total above this amount."
              draft={daily}
              disabled={saving}
              onChange={setDaily}
            />
            <MoneyControl
              id="mcp-web-approval"
              label="Require a MaxVideoAI web review above"
              help="Amounts strictly above this value must be reviewed on MaxVideoAI."
              draft={webApproval}
              disabled={saving}
              onChange={setWebApproval}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save spending controls'}
            </Button>
            <p
              aria-live="polite"
              className={notice?.kind === 'error' ? 'text-sm text-danger' : 'text-sm text-success'}
            >
              {notice?.message ?? ''}
            </p>
          </div>
        </form>
      )}

      <div className="mt-8 border-t border-border pt-6">
        <h3 className="text-base font-semibold text-text-primary">Recent MCP activity</h3>
        <p className="mt-1 text-sm text-text-secondary">The 20 newest quote and confirmation events for your account.</p>
        {activityUnavailable ? (
          <p className="mt-4 rounded-input border border-border bg-surface-2 p-3 text-sm text-text-secondary">
            Recent activity is unavailable right now.
          </p>
        ) : initialActivity.length === 0 ? (
          <p className="mt-4 rounded-input border border-border bg-surface-2 p-3 text-sm text-text-secondary">
            No MCP generation activity yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-input border border-border">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">Application</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Action</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Model</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Amount</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Outcome</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialActivity.map((item, index) => (
                  <tr key={`${item.timestamp}-${item.model}-${index}`} className="text-text-secondary">
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-text-primary">{item.clientLabel}</td>
                    <td className="whitespace-nowrap px-3 py-3">{toolLabels[item.tool]}</td>
                    <td className="whitespace-nowrap px-3 py-3">{item.model}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {new Intl.NumberFormat(undefined, { style: 'currency', currency: item.currency }).format(item.amountCents / 100)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{outcomeLabels[item.outcome]}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <time dateTime={item.timestamp}>
                        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.timestamp))}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
