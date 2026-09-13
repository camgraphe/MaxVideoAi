import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { useHostedWalletCheckout } from '@/hooks/useHostedWalletCheckout';
import type { AppLocale } from '@/i18n/locales';
import { dispatchGaEvent } from '@/lib/analytics/ga-events';
import { classifyTopupFailure } from '@/lib/analytics/topup-failure';
import { formatRateLimitMessage } from '@/lib/wallet/rate-limit-message';
import type { EngineCaps, Mode, PreflightResponse } from '@/types/engines';
import type { WorkspaceCopy } from '../_lib/workspace-copy';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import { buildWorkspacePreflightRequest } from '../_lib/workspace-preflight-request';
import { useWorkspacePreflightQuote } from './useWorkspacePreflightQuote';
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
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
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
  checkoutCaptchaResetGeneration: number;
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
  inputAssets,
}: UseWorkspacePricingGateOptions): UseWorkspacePricingGateResult {
  const { preflight, preflightError, setPreflightError, isPricing, price, currency } = useWorkspacePreflightQuote({
    request: form && selectedEngine ? buildWorkspacePreflightRequest({
      form, selectedEngine, memberTier, supportsAudioToggle,
      effectiveDurationSec, voiceControlEnabled, submissionMode, inputAssets,
    }) : null,
    iterations: form?.iterations ?? 1,
    accessToken,
    authChecked,
  });
  const [topUpModal, setTopUpModal] = useState<TopUpModalState>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  const showComposerError = useCallback((message: string) => {
    setPreflightError(message);
  }, [setPreflightError]);

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
      failure_category: classifyTopupFailure(reason),
    });
    setTopUpError(topUpCopy.startError);
  }, [topUpCopy.startError]);

  const handleHostedRateLimited = useCallback((seconds: number | null) => {
    setTopUpError(formatRateLimitMessage(topUpCopy.rateLimited, seconds ?? 900));
  }, [topUpCopy.rateLimited]);

  const {
    captchaError: checkoutCaptchaError,
    captchaRequired: checkoutCaptchaRequired,
    captchaResetGeneration: checkoutCaptchaResetGeneration,
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
    setTopUpError(null);
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
    if (authChecked) setMemberTier('Member');
  }, [authChecked, setMemberTier]);

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
      checkoutCaptchaResetGeneration,
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
      checkoutCaptchaResetGeneration,
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
      setPreflightError,
      topUpAmount,
      topUpError,
      topUpModal,
    ]
  );
}
