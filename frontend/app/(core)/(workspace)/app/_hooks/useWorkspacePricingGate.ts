import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { useHostedWalletCheckout } from '@/hooks/useHostedWalletCheckout';
import type { AppLocale } from '@/i18n/locales';
import { dispatchGaEvent } from '@/lib/analytics/ga-events';
import { classifyTopupFailure } from '@/lib/analytics/topup-failure';
import { getVideoExcerptLimits, mediaExcerptNeedsSelection } from '@/lib/video-excerpt';
import { getEngineModeUnavailableMessage } from '@/lib/engine-mode-availability';
import { getVideoWorkflowSourceField, getVideoWorkflowSourceState, isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import { formatRateLimitMessage } from '@/lib/wallet/rate-limit-message';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import { getWorkspaceKlingV4MediaError } from '../_lib/workspace-kling-v4-media';
import { buildKlingElementsPayload } from '../_lib/workspace-generation-inputs';
import type { EngineCaps, Mode, PreflightResponse } from '@/types/engines';
import type { WorkspaceCopy } from '../_lib/workspace-copy';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import { buildWorkspacePreflightRequest } from '../_lib/workspace-preflight-request';
import { useWorkspacePreflightQuote } from './useWorkspacePreflightQuote';
import { getWorkspaceVideoDurationGuidance } from '../_lib/workspace-video-duration-guidance';
import { useWorkspaceTopupPaymentQuote } from './useWorkspaceTopupPaymentQuote';
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
  klingElements?: KlingElementState[];
};

type UseWorkspacePricingGateResult = {
  preflight: PreflightResponse | null;
  preflightError: string | undefined;
  videoDurationBlocked: boolean;
  isPricing: boolean;
  price: number | null;
  currency: string;
  topUpModal: TopUpModalState;
  topUpAmount: number;
  topUpChargeCurrency: string;
  topUpPaymentAmountMinor: number | null;
  topUpQuoteLoading: boolean;
  topUpQuoteError: boolean;
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
  klingElements = [],
}: UseWorkspacePricingGateOptions): UseWorkspacePricingGateResult {
  const elementValidation = selectedEngine?.id === 'kling-v4' ? buildKlingElementsPayload({
    selectedEngineId: selectedEngine.id, submissionMode, supportsKlingV3Controls: false, klingElements,
  }) : null;
  const elementError = elementValidation && !elementValidation.ok ? elementValidation.message
    : selectedEngine?.id === 'kling-v4' ? getWorkspaceKlingV4MediaError({ mode: submissionMode, inputAssets, klingElements, locale }) : null;
  const modeUnavailableMessage = getEngineModeUnavailableMessage(selectedEngine, submissionMode, locale);
  const waitingForExcerpt = selectedEngine && mediaExcerptNeedsSelection(selectedEngine, submissionMode, inputAssets);
  const ownedGenerationRequired = (selectedEngine?.id === 'luma-ray-3-2' && submissionMode === 'extend') || form?.operation === 'flux-draft-enhance';
  const waitingForVideoSource = (ownedGenerationRequired && !form?.extraInputValues.source_job_id) || isVideoSourceWorkflow(submissionMode)
    && Boolean(getVideoWorkflowSourceField(selectedEngine?.inputSchema, submissionMode))
    && getVideoWorkflowSourceState(selectedEngine?.inputSchema, inputAssets, submissionMode, selectedEngine ? getVideoExcerptLimits(selectedEngine, submissionMode) : null) !== 'ready';
  const videoDurationError = getWorkspaceVideoDurationGuidance({
    engine: selectedEngine, mode: submissionMode, inputAssets, outputDurationSec: effectiveDurationSec, locale,
  });
  const { preflight, preflightError: quoteError, videoDurationBlocked: serverVideoDurationBlocked, setPreflightError, isPricing, price, currency } = useWorkspacePreflightQuote({
    request: form && selectedEngine && !modeUnavailableMessage && !waitingForVideoSource && !waitingForExcerpt && !elementError && !videoDurationError ? buildWorkspacePreflightRequest({
      form, selectedEngine, memberTier, supportsAudioToggle,
      effectiveDurationSec, voiceControlEnabled, submissionMode, inputAssets, klingElements,
    }) : null,
    iterations: form?.iterations ?? 1,
    accessToken,
    authChecked,
    locale,
  });
  const preflightError = modeUnavailableMessage ?? elementError ?? videoDurationError ?? quoteError;
  const videoDurationBlocked = Boolean(videoDurationError) || serverVideoDurationBlocked;
  const [topUpModal, setTopUpModal] = useState<TopUpModalState>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const {
    chargeCurrency: topUpChargeCurrency,
    paymentAmountMinor: topUpPaymentAmountMinor,
    quoteLoading: topUpQuoteLoading,
    quoteError: topUpQuoteError,
  } = useWorkspaceTopupPaymentQuote({
    accessToken,
    amountCents: topUpAmount,
    enabled: Boolean(topUpModal),
  });

  const showComposerError = useCallback((message: string) => {
    setPreflightError(message);
  }, [setPreflightError]);

  const handleHostedTopupStarted = useCallback(({ amountCents, currency }: { amountCents: number; currency: string }) => {
    const payload = buildWorkspaceTopupAnalyticsPayload(amountCents, currency);
    void dispatchGaEvent('topup_started', payload);
    void dispatchGaEvent('topup_checkout_opened', payload);
  }, []);

  const handleHostedTopupFailed = useCallback(({
    amountCents,
    currency,
    reason,
  }: {
    amountCents: number;
    currency: string;
    reason: string;
  }) => {
    void dispatchGaEvent('topup_failed', {
      ...buildWorkspaceTopupAnalyticsPayload(amountCents, currency),
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
    currency: topUpChargeCurrency,
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
    if (!topUpModal || topUpQuoteLoading) return;
    setTopUpError(null);
    void startCheckout();
  }, [startCheckout, topUpModal, topUpQuoteLoading]);

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
      videoDurationBlocked,
      isPricing,
      price,
      currency,
      topUpModal,
      topUpAmount,
      topUpChargeCurrency,
      topUpPaymentAmountMinor,
      topUpQuoteLoading,
      topUpQuoteError,
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
      videoDurationBlocked,
      price,
      showComposerError,
      setPreflightError,
      topUpAmount,
      topUpChargeCurrency,
      topUpPaymentAmountMinor,
      topUpQuoteLoading,
      topUpQuoteError,
      topUpError,
      topUpModal,
    ]
  );
}
