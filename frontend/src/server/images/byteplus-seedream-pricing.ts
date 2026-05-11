import type { PricingSnapshot } from '@/types/engines';
import { buildReceiptSnapshot } from './image-generation-receipts';

export function resolveBytePlusSeedreamOutputPricing(params: {
  generatedImages: number;
  priceOnlyReceipts: boolean;
  pricing: PricingSnapshot;
  requestedImages: number;
}): {
  adjustedPricing: PricingSnapshot;
  adjustedPricingSnapshotJson: string;
  missingImages: number;
  partialRefundCents: number;
} {
  const requestedImages = Math.max(1, Math.round(params.requestedImages));
  const generatedImages = Math.max(0, Math.round(params.generatedImages));
  const missingImages = Math.max(0, requestedImages - generatedImages);

  if (!missingImages) {
    const snapshot = params.priceOnlyReceipts ? buildReceiptSnapshot(params.pricing) : params.pricing;
    return {
      adjustedPricing: params.pricing,
      adjustedPricingSnapshotJson: JSON.stringify(snapshot),
      missingImages: 0,
      partialRefundCents: 0,
    };
  }

  const adjustedTotalCents = Math.max(0, Math.round((params.pricing.totalCents * generatedImages) / requestedImages));
  const partialRefundCents = Math.max(0, params.pricing.totalCents - adjustedTotalCents);
  const adjustedPricing: PricingSnapshot = {
    ...params.pricing,
    totalCents: adjustedTotalCents,
    meta: {
      ...(params.pricing.meta ?? {}),
      generatedImages,
      missingImages,
      originalRequestedImages: requestedImages,
      originalTotalCents: params.pricing.totalCents,
      partialRefundCents,
      pricingAdjustedForGeneratedImages: true,
    },
  };
  const snapshot = params.priceOnlyReceipts ? buildReceiptSnapshot(adjustedPricing) : adjustedPricing;

  return {
    adjustedPricing,
    adjustedPricingSnapshotJson: JSON.stringify(snapshot),
    missingImages,
    partialRefundCents,
  };
}
