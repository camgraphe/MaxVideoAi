import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { useHostedWalletCheckout } from '@/hooks/useHostedWalletCheckout';
import type { AppLocale } from '@/i18n/locales';
import { dispatchGaEvent } from '@/lib/analytics/ga-events';
import { runPreflight } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import type { EngineCaps, Mode, PreflightRequest, PreflightResponse } from '@/types/engines';
import { formatRateLimitMessage } from '../../../billing/_lib/rate-limit-message';
import type { WorkspaceCopy } from '../_lib/workspace-copy';
import type { FormState } from '../_lib/workspace-form-state';
import { DEBOUNCE_MS } from '../_lib/workspace-client-helpers';
import {
  buildWorkspaceTopupAnalyticsPayload,
  getSufficientTopUpAmountCents,
} from '../_lib/workspace-topup';

export type MemberTier = 'Member' | 'Plus' | 'Pro';

export type TopUpModalState = {
  message: string;
  amountLabel?: string;
  shortfallCents?: number;
} | null;

type UseWorkspacePricingGateOptions = {
  accessToken: string | null;
  locale: AppLocale;
  topUpCopy: WorkspaceCopy['topUp'];
  form: FormState | null;
  selectedEngine: EngineCaps | null;
  authChecked: boolean;
  memberTier: MemberTier;
  setMemberTier: Dispatch<SetStateAction<MemberTier>>;
  supportsAudioToggle: boolean;
  effectiveDurationSec: number;
  voiceControlEnabled: boolean;
  submissionMode: Mode;
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
  checkoutCaptchaError: boolean;
  checkoutCaptchaRequired: boolean;
  checkoutCaptchaToken: string | null;
  authModalOpen: boolean;
  showComposerError: (message: string) => void;
  closeTopUpModal: () => void;
  handleSelectPresetAmount: (value: number) => void;
  handleCustomAmountChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleCheckoutCaptchaError: () => void;
  handleCheckoutCaptchaToken: (token: string | null) => void;
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
  accessToken,
  locale,
  topUpCopy,
  form,
  selectedEngine,
  authChecked,
  memberTier,
  setMemberTier,
  supportsAudioToggle,
  effectiveDurationSec,
  voiceControlEnabled,
  submissionMode,
}: UseWorkspacePricingGateOptions): UseWorkspacePricingGateResult {
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [preflightError, setPreflightError] = useState<string | undefined>();
  const [isPricing, setPricing] = useState(false);
  const [topUpModal, setTopUpModal] = useState<TopUpModalState>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  const showComposerError = useCallback((message: string) => {
    setPreflightError(message);
  }, []);

  const handleHostedTopupStarted = useCallback(({ amountCents }: { amountCents: number; currency: string }) => {
    const payload = buildWorkspaceTopupAnalyticsPayload(amountCents);
    void dispatchGaEvent('topup_started', payload);
    void dispatchGaEvent('topup_checkout_opened', payload);
  }, []);

  const handleHostedTopupFailed = useCallback(({
    amountCents,
    reason,
  }: {
    amountCents: number;
    currency: string;
    reason: string;
  }) => {
    void dispatchGaEvent('topup_failed', {
      ...buildWorkspaceTopupAnalyticsPayload(amountCents),
      error_message: reason,
    });
    setTopUpError(topUpCopy.startError);
  }, [topUpCopy.startError]);

  const handleHostedRateLimited = useCallback((seconds: number | null) => {
    setTopUpError(formatRateLimitMessage(topUpCopy.rateLimited, seconds ?? 900));
  }, [topUpCopy.rateLimited]);

  const {
    captchaError: checkoutCaptchaError,
    captchaRequired: checkoutCaptchaRequired,
    captchaToken: checkoutCaptchaToken,
    handleCaptchaError: handleCheckoutCaptchaError,
    handleCaptchaToken: handleCheckoutCaptchaToken,
    isSubmitting: isTopUpLoading,
    resetCheckout,
    startCheckout,
  } = useHostedWalletCheckout({
    accessToken,
    amountCents: topUpAmount,
    currency: 'USD',
    locale,
    source: 'workspace',
    returnTarget: '/app',
    onStarted: handleHostedTopupStarted,
    onFailed: handleHostedTopupFailed,
    onRateLimited: handleHostedRateLimited,
  });

  useEffect(() => {
    if (!topUpModal) return;
    setTopUpAmount(getSufficientTopUpAmountCents(topUpModal.shortfallCents));
    setTopUpError(null);
    resetCheckout();
  }, [resetCheckout, topUpModal]);

  const closeTopUpModal = useCallback(() => {
    setTopUpModal(null);
    setTopUpAmount(1000);
    setTopUpError(null);
    resetCheckout();
  }, [resetCheckout]);

  const handleSelectPresetAmount = useCallback((value: number) => {
    setTopUpAmount(value);
    setTopUpError(null);
  }, []);

  const handleCustomAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setTopUpError(null);
    if (Number.isNaN(value)) {
      setTopUpAmount(1000);
      return;
    }
    setTopUpAmount(Math.max(1000, Math.round(value * 100)));
  }, []);

  const handleConfirmTopUp = useCallback(() => {
    if (!topUpModal) return;
    void startCheckout();
  }, [startCheckout, topUpModal]);

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
      ...(Object.keys(form.extraInputValues).length ? { extraInputValues: form.extraInputValues } : {}),
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
      checkoutCaptchaError,
      checkoutCaptchaRequired,
      checkoutCaptchaToken,
      authModalOpen,
      showComposerError,
      closeTopUpModal,
      handleSelectPresetAmount,
      handleCustomAmountChange,
      handleCheckoutCaptchaError,
      handleCheckoutCaptchaToken,
      handleTopUpSubmit,
      setAuthModalOpen,
      setPreflightError,
      setTopUpModal,
    }),
    [
      authModalOpen,
      closeTopUpModal,
      currency,
      checkoutCaptchaError,
      checkoutCaptchaRequired,
      checkoutCaptchaToken,
      handleCustomAmountChange,
      handleCheckoutCaptchaError,
      handleCheckoutCaptchaToken,
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
