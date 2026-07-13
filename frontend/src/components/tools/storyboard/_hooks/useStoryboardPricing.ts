'use client';

import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import { STORYBOARD_EDIT_SOURCE, STORYBOARD_SOURCE } from '@/lib/storyboard-pricing';
import { resolveStoryboardVisiblePrice } from '../_lib/storyboard-price-display';
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

export type StoryboardPriceValue = { cents: number; currency: string } | null;
export type StoryboardPriceState = Record<StoryboardTier, StoryboardPriceValue>;

export type UseStoryboardPricingParams = {
  locale: string;
  storyboardOrientation: StoryboardOrientation;
  storyboardTier: StoryboardTier;
  targetModel: StoryboardTargetModel;
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
  selectedImage,
}: UseStoryboardPricingParams): {
  tierConfig: StoryboardOutputConfig;
  editOutputConfig: StoryboardOutputConfig;
  klingFirstFramePrice: StoryboardPriceValue;
  activePrice: string;
  editPriceLabel: string;
  tierPriceLabels: Record<StoryboardTier, string>;
} {
  const [tierPrices, setTierPrices] = useState<StoryboardPriceState>({ hd: null, '4k': null, ultra: null });
  const [editPrice, setEditPrice] = useState<StoryboardPriceValue>(null);
  const tierConfig = getStoryboardOutputConfig(storyboardTier, storyboardOrientation);
  const editOutputConfig = getStoryboardEditOutputConfig();

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
              engineId: 'gpt-image-2',
              mode: 'i2i',
              numImages: 1,
              referenceImageSizes: [STORYBOARD_TEMPLATE_SIZES[storyboardOrientation]],
              resolution: config.resolution,
              customImageSize: config.customImageSize,
              quality: config.quality,
              source: STORYBOARD_SOURCE,
            }),
          });
          const payload = (await response.json().catch(() => null)) as {
            ok?: boolean;
            pricing?: { totalCents?: number; currency?: string };
          } | null;
          return [
            tier,
            payload?.ok && payload.pricing?.totalCents != null
              ? { cents: payload.pricing.totalCents, currency: payload.pricing.currency ?? 'USD' }
              : null,
          ] as const;
        })
      );
      if (!active) return;
      setTierPrices(Object.fromEntries(entries) as StoryboardPriceState);
    }
    void loadPrices().catch(() => {
      if (active) setTierPrices({ hd: null, '4k': null, ultra: null });
    });
    return () => {
      active = false;
    };
  }, [storyboardOrientation]);

  useEffect(() => {
    if (!selectedImage?.url) {
      setEditPrice(null);
      return;
    }

    let active = true;
    const selectedImageWidth = selectedImage.width ?? null;
    const selectedImageHeight = selectedImage.height ?? null;
    async function loadEditPrice() {
      const response = await authFetch('/api/images/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId: 'gpt-image-2',
          mode: 'i2i',
          numImages: 1,
          referenceImageSizes: [{ width: selectedImageWidth, height: selectedImageHeight }],
          resolution: editOutputConfig.resolution,
          customImageSize: editOutputConfig.customImageSize,
          quality: editOutputConfig.quality,
          source: STORYBOARD_EDIT_SOURCE,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        pricing?: { totalCents?: number; currency?: string };
      } | null;
      if (!active) return;
      setEditPrice(
        payload?.ok && payload.pricing?.totalCents != null
          ? { cents: payload.pricing.totalCents, currency: payload.pricing.currency ?? 'USD' }
          : null
      );
    }
    void loadEditPrice().catch(() => {
      if (active) setEditPrice(null);
    });
    return () => {
      active = false;
    };
  }, [
    selectedImage?.height,
    selectedImage?.url,
    selectedImage?.width,
    editOutputConfig.customImageSize,
    editOutputConfig.quality,
    editOutputConfig.resolution,
  ]);

  const klingFirstFramePrice = tierPrices.hd;
  const tierPriceLabels = useMemo(
    () =>
      Object.fromEntries(
        STORYBOARD_TIER_OPTIONS.map((tier) => [
          tier,
          formatStoryboardPrice(
            resolveStoryboardVisiblePrice({
              targetModel,
              tierPrice: tierPrices[tier],
              klingFirstFramePrice,
            }),
            locale
          ),
        ])
      ) as Record<StoryboardTier, string>,
    [klingFirstFramePrice, locale, targetModel, tierPrices]
  );
  const activePrice = tierPriceLabels[storyboardTier];
  const editPriceLabel = useMemo(() => formatStoryboardPrice(editPrice, locale), [editPrice, locale]);

  return {
    tierConfig,
    editOutputConfig,
    klingFirstFramePrice,
    activePrice,
    editPriceLabel,
    tierPriceLabels,
  };
}
