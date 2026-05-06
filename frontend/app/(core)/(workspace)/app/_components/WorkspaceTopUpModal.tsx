import clsx from 'clsx';
import type { ChangeEvent, FormEvent } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CURRENCY_LOCALE } from '@/lib/intl';
import type { TopUpModalState } from '../_hooks/useWorkspacePricingGate';

type WorkspaceTopUpCopy = {
  title: string;
  otherAmountLabel: string;
  minLabel: string;
  close: string;
  maybeLater: string;
  submit: string;
  submitting: string;
};

type WorkspaceTopUpModalProps = {
  modal: NonNullable<TopUpModalState>;
  copy: WorkspaceTopUpCopy;
  currency: string;
  topUpAmount: number;
  isTopUpLoading: boolean;
  topUpError: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectPresetAmount: (value: number) => void;
  onCustomAmountChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function WorkspaceTopUpModal({
  modal,
  copy,
  currency,
  topUpAmount,
  isTopUpLoading,
  topUpError,
  onClose,
  onSubmit,
  onSelectPresetAmount,
  onCustomAmountChange,
}: WorkspaceTopUpModalProps) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-40 px-4">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <form
        className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text-primary">Wallet balance too low</h2>
            <p className="mt-2 text-sm text-text-secondary">{modal.message}</p>
            {modal.amountLabel && (
              <p className="mt-2 text-sm font-medium text-text-primary">
                Suggested top-up: {modal.amountLabel}
              </p>
            )}
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1000, 2500, 5000].map((value) => {
                  const formatted = (() => {
                    try {
                      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(value / 100);
                    } catch {
                      return `${currency} ${(value / 100).toFixed(2)}`;
                    }
                  })();
                  const isActive = topUpAmount === value;
                  return (
                    <Button
                      key={value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectPresetAmount(value)}
                      className={clsx(
                        'min-h-0 h-8 px-3 py-1.5 text-sm font-medium',
                        isActive
                          ? 'border-brand bg-surface-2 text-brand hover:border-brand'
                          : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                      )}
                    >
                      {formatted}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-3">
                <label htmlFor="custom-topup" className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {copy.otherAmountLabel}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-secondary">
                      $
                    </span>
                    <Input
                      id="custom-topup"
                      type="number"
                      min={10}
                      step={1}
                      value={Math.max(10, Math.round(topUpAmount / 100))}
                      onChange={onCustomAmountChange}
                      className="h-10 pl-6 pr-3"
                    />
                  </div>
                  <span className="text-xs text-text-muted">
                    {copy.minLabel.replace('{amount}', '$10')}
                  </span>
                </div>
              </div>
              {topUpError && <p className="mt-2 text-sm text-state-warning">{topUpError}</p>}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
            aria-label={copy.close}
          >
            {copy.close}
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="px-4">
            {copy.maybeLater}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isTopUpLoading}
            className={clsx('px-4', !isTopUpLoading && 'hover:brightness-105')}
          >
            {isTopUpLoading ? copy.submitting : copy.submit}
          </Button>
        </div>
      </form>
    </div>
  );
}
