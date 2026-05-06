import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { runPreflight } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import type { EngineCaps, Mode, PreflightRequest, PreflightResponse } from '@/types/engines';
import type { FormState } from '../_lib/workspace-form-state';
import { DEBOUNCE_MS } from '../_lib/workspace-client-helpers';

export type MemberTier = 'Member' | 'Plus' | 'Pro';

export type TopUpModalState = {
  message: string;
  amountLabel?: string;
  shortfallCents?: number;
} | null;

type UseWorkspacePricingGateOptions = {
  form: FormState | null;
  selectedEngine: EngineCaps | null;
  authChecked: boolean;
  memberTier: MemberTier;
  setMemberTier: Dispatch<SetStateAction<MemberTier>>;
  supportsAudioToggle: boolean;
  effectiveDurationSec: number;
  voiceControlEnabled: boolean;
  submissionMode: Mode;
  showNotice: (message: string) => void;
};

type UseWorkspacePricingGateResult = {
  preflight: PreflightResponse | null;
  preflightError: string | undefined;
  isPricing: boolean;
  price: number | null;
  currency: string;
  topUpModal: TopUpModalState;
  topUpAmount: number;
  isTopUpLoading: boolean;
  topUpError: string | null;
  authModalOpen: boolean;
  showComposerError: (message: string) => void;
  closeTopUpModal: () => void;
  handleSelectPresetAmount: (value: number) => void;
  handleCustomAmountChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleTopUpSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setAuthModalOpen: Dispatch<SetStateAction<boolean>>;
  setPreflightError: Dispatch<SetStateAction<string | undefined>>;
  setTopUpModal: Dispatch<SetStateAction<TopUpModalState>>;
};

function getPreflightErrorMessage(response: PreflightResponse): string {
  return (
    (typeof response.error?.message === 'string' && response.error.message.trim().length
      ? response.error.message.trim()
      : undefined) ??
    response.messages?.find((entry) => typeof entry === 'string' && entry.trim().length)?.trim() ??
    'Unable to compute pricing'
  );
}

export function useWorkspacePricingGate({
  form,
  selectedEngine,
  authChecked,
  memberTier,
  setMemberTier,
  supportsAudioToggle,
  effectiveDurationSec,
  voiceControlEnabled,
  submissionMode,
  showNotice,
}: UseWorkspacePricingGateOptions): UseWorkspacePricingGateResult {
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [preflightError, setPreflightError] = useState<string | undefined>();
  const [isPricing, setPricing] = useState(false);
  const [topUpModal, setTopUpModal] = useState<TopUpModalState>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  const showComposerError = useCallback((message: string) => {
    setPreflightError(message);
  }, []);

  const closeTopUpModal = useCallback(() => {
    setTopUpModal(null);
    setTopUpAmount(1000);
    setTopUpError(null);
  }, []);

  const handleSelectPresetAmount = useCallback((value: number) => {
    setTopUpAmount(value);
  }, []);

  const handleCustomAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      setTopUpAmount(1000);
      return;
    }
    setTopUpAmount(Math.max(1000, Math.round(value * 100)));
  }, []);

  const handleConfirmTopUp = useCallback(async () => {
    if (!topUpModal) return;
    const amountCents = Math.max(1000, topUpAmount);
    setIsTopUpLoading(true);
    setTopUpError(null);
    try {
      const res = await authFetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? 'Wallet top-up failed');
      }
      if (json?.url) {
        window.location.href = json.url as string;
        return;
      }
      closeTopUpModal();
      showNotice('Top-up initiated. Complete the payment to update your balance.');
    } catch (error) {
      setTopUpError(error instanceof Error ? error.message : 'Failed to start top-up');
    } finally {
      setIsTopUpLoading(false);
    }
  }, [closeTopUpModal, showNotice, topUpAmount, topUpModal]);

  const handleTopUpSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleConfirmTopUp();
    },
    [handleConfirmTopUp]
  );

  useEffect(() => {
    if (!authChecked) return undefined;
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch('/api/member-status');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) {
          const tier = (json?.tier ?? 'Member') as MemberTier;
          setMemberTier(tier);
        }
      } catch {
        // noop
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authChecked, setMemberTier]);

  useEffect(() => {
    if (!topUpModal) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTopUpModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [topUpModal, closeTopUpModal]);

  useEffect(() => {
    if (!form || !selectedEngine || !authChecked) return;
    let canceled = false;

    const payload: PreflightRequest = {
      engine: form.engineId,
      mode: submissionMode,
      durationSec: effectiveDurationSec,
      resolution: form.resolution as PreflightRequest['resolution'],
      aspectRatio: form.aspectRatio as PreflightRequest['aspectRatio'],
      fps: form.fps,
      seedLocked: Boolean(form.seedLocked),
      loop: form.loop,
      ...(supportsAudioToggle ? { audio: form.audio } : {}),
      ...(voiceControlEnabled ? { voiceControl: true } : {}),
      user: { memberTier },
    };
    setPricing(true);
    setPreflightError(undefined);

    const timeout = setTimeout(() => {
      Promise.resolve()
        .then(() => runPreflight(payload))
        .then((response) => {
          if (canceled) return;
          setPreflight(response);
          if (!response.ok) {
            setPreflightError(getPreflightErrorMessage(response));
            return;
          }
          setPreflightError(undefined);
        })
        .catch((err) => {
          if (canceled) return;
          console.error('[preflight] failed', err);
          setPreflightError(err instanceof Error ? err.message : 'Preflight failed');
        })
        .finally(() => {
          if (!canceled) {
            setPricing(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [
    form,
    selectedEngine,
    memberTier,
    authChecked,
    supportsAudioToggle,
    effectiveDurationSec,
    voiceControlEnabled,
    submissionMode,
  ]);

  const singlePriceCents = typeof preflight?.total === 'number' ? preflight.total : null;
  const singlePrice = typeof singlePriceCents === 'number' ? singlePriceCents / 100 : null;
  const price =
    typeof singlePrice === 'number' && form?.iterations
      ? singlePrice * form.iterations
      : singlePrice;
  const currency = preflight?.currency ?? 'USD';

  return useMemo(
    () => ({
      preflight,
      preflightError,
      isPricing,
      price,
      currency,
      topUpModal,
      topUpAmount,
      isTopUpLoading,
      topUpError,
      authModalOpen,
      showComposerError,
      closeTopUpModal,
      handleSelectPresetAmount,
      handleCustomAmountChange,
      handleTopUpSubmit,
      setAuthModalOpen,
      setPreflightError,
      setTopUpModal,
    }),
    [
      authModalOpen,
      closeTopUpModal,
      currency,
      handleCustomAmountChange,
      handleSelectPresetAmount,
      handleTopUpSubmit,
      isPricing,
      isTopUpLoading,
      preflight,
      preflightError,
      price,
      showComposerError,
      topUpAmount,
      topUpError,
      topUpModal,
    ]
  );
}
