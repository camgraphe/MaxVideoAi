'use client';

import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import { CUSTOMER_PRICING_REFRESH_EVENT } from '@/lib/customer-tariff-revision';
import type { PricingSnapshot } from '@/types/engines';
import { STORYBOARD_EDIT_SOURCE, STORYBOARD_IMAGE_ENGINE_ID, STORYBOARD_SOURCE } from '@/lib/storyboard-pricing';
import type { StoryboardTargetModel } from '../_lib/storyboard-prompt';
import {
  STORYBOARD_TEMPLATE_SIZES,
  STORYBOARD_TIER_OPTIONS,
  getStoryboardEditOutputConfig,
  getStoryboardOutputConfig,
  type StoryboardOrientation,
  type StoryboardOutputConfig,
  type StoryboardTier,
} from '../_lib/storyboard-templates';

export type StoryboardPriceValue = { cents: number; currency: string; pricing?: PricingSnapshot } | null;
export type StoryboardPriceState = Record<StoryboardTier, StoryboardPriceValue>;

export type UseStoryboardPricingParams = {
  locale: string;
  storyboardOrientation: StoryboardOrientation;
  storyboardTier: StoryboardTier;
  targetModel: StoryboardTargetModel;
  referenceImageCount: number;
  selectedImage: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
};

export function formatStoryboardPrice(value: StoryboardPriceValue, locale: string): string {
  if (!value) return '...';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: value.currency }).format(value.cents / 100);
  } catch {
    return `${value.currency} ${(value.cents / 100).toFixed(2)}`;
  }
}

export function useStoryboardPricing({
  locale,
  storyboardOrientation,
  storyboardTier,
  targetModel,
  referenceImageCount,
  selectedImage,
}: UseStoryboardPricingParams): {
  tierConfig: StoryboardOutputConfig;
  editOutputConfig: StoryboardOutputConfig;
  activePrice: string;
  editPriceLabel: string;
  tierPriceLabels: Record<StoryboardTier, string>;
  generationPricingSnapshot: PricingSnapshot | null;
  editPricingSnapshot: PricingSnapshot | null;
} {
  const [tierQuotes, setTierQuotes] = useState<{ key: string; prices: StoryboardPriceState } | null>(null);
  const [editQuote, setEditQuote] = useState<{ key: string; price: StoryboardPriceValue } | null>(null);
  const [priceRefresh, setPriceRefresh] = useState(0);
  useEffect(() => {
    const refresh = () => setPriceRefresh((value) => value + 1);
    window.addEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refresh);
  }, []);
  const tierConfig = getStoryboardOutputConfig(storyboardTier, storyboardOrientation);
  const selectedUrl = selectedImage?.url;
  const selectedWidth = selectedImage?.width ?? null;
  const selectedHeight = selectedImage?.height ?? null;
  const editOutputConfig = useMemo(() => getStoryboardEditOutputConfig({ width: selectedWidth, height: selectedHeight }),
    [selectedWidth, selectedHeight]);
  const tierKey = `${storyboardOrientation}:${targetModel}:${referenceImageCount}:${priceRefresh}`;
  const editKey = JSON.stringify([selectedUrl, selectedWidth, selectedHeight, priceRefresh]);
  const tierPrices = tierQuotes?.key === tierKey ? tierQuotes.prices : null;
  const editPrice = editQuote?.key === editKey ? editQuote.price : null;

  useEffect(() => {
    let active = true;
    async function loadPrices() {
      const entries = await Promise.all(
        STORYBOARD_TIER_OPTIONS.map(async (tier) => {
          const config = getStoryboardOutputConfig(tier, storyboardOrientation);
          const response = await authFetch('/api/images/estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              engineId: STORYBOARD_IMAGE_ENGINE_ID,
              mode: 'i2i',
              numImages: 1,
              referenceImageSizes: [STORYBOARD_TEMPLATE_SIZES[storyboardOrientation]],
              referenceImageCount,
              resolution: config.resolution,
              customImageSize: config.customImageSize,
              quality: config.quality,
              source: STORYBOARD_SOURCE,
              metadata: { storyboard: { role: 'board', targetModel } },
            }),
          });
          const payload = (await response.json().catch(() => null)) as {
            ok?: boolean;
            pricing?: PricingSnapshot;
          } | null;
          return [
            tier,
            payload?.ok && payload.pricing?.totalCents != null
              ? { cents: payload.pricing.totalCents, currency: payload.pricing.currency ?? 'USD', pricing: payload.pricing }
              : null,
          ] as const;
        })
      );
      if (!active) return;
      setTierQuotes({ key: tierKey, prices: Object.fromEntries(entries) as StoryboardPriceState });
    }
    void loadPrices().catch(() => {
      if (active) setTierQuotes(null);
    });
    return () => {
      active = false;
    };
  }, [storyboardOrientation, targetModel, referenceImageCount, tierKey]);

  useEffect(() => {
    if (!selectedUrl) return;
    let active = true;
    async function loadEditPrice() {
      const response = await authFetch('/api/images/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId: STORYBOARD_IMAGE_ENGINE_ID,
          mode: 'i2i',
          numImages: 1,
          referenceImageSizes: [{ width: selectedWidth, height: selectedHeight }],
          resolution: editOutputConfig.resolution,
          customImageSize: editOutputConfig.customImageSize,
          quality: editOutputConfig.quality,
          source: STORYBOARD_EDIT_SOURCE,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        pricing?: PricingSnapshot;
      } | null;
      if (!active) return;
      setEditQuote({
        key: editKey,
        price: payload?.ok && payload.pricing?.totalCents != null
          ? { cents: payload.pricing.totalCents, currency: payload.pricing.currency ?? 'USD', pricing: payload.pricing }
          : null,
      });
    }
    void loadEditPrice().catch(() => {
      if (active) setEditQuote(null);
    });
    return () => {
      active = false;
    };
  }, [selectedUrl, selectedWidth, selectedHeight, editOutputConfig, editKey]);

  const tierPriceLabels = useMemo(() => Object.fromEntries(
    STORYBOARD_TIER_OPTIONS.map(tier => [tier, formatStoryboardPrice(tierPrices?.[tier] ?? null, locale)])
  ) as Record<StoryboardTier, string>, [locale, tierPrices]);
  const activePrice = tierPriceLabels[storyboardTier];
  const editPriceLabel = useMemo(() => formatStoryboardPrice(editPrice, locale), [editPrice, locale]);

  return {
    tierConfig,
    editOutputConfig,
    activePrice,
    editPriceLabel,
    tierPriceLabels,
    generationPricingSnapshot: tierPrices?.[storyboardTier]?.pricing ?? null,
    editPricingSnapshot: editPrice?.pricing ?? null,
  };
}
