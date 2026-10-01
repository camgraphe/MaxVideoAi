export type BytePlusContractInput = {
  engineId: string;
  executionProvider: string;
  accountContractRegion?: string;
  resolution: string;
  step: 'normal' | 'draft' | 'final';
  billingInputType?: 'no_video_input' | 'video_input';
  outputPixels?: number[];
  inputImages?: number;
};

/** Signed commercial terms, adopted for local pricing by Adrien on 2026-10-01.
 * Console activation is a release check; this projection is not an invoice.
 * LIST remains the independent dated tariff. Discounts never stack with campaigns.
 */
const CONTRACT = {
  id: 'CT20260925128931',
  sourceUrl: 'https://console.byteplus.com/finance/contract',
  startsAt: '2026-10-01T00:00:00+08:00',
  endsAt: '2027-08-27T00:00:00+08:00',
  region: 'ap-southeast-1',
} as const;

export type BytePlusContractTerms = {
  id: string;
  sourceUrl: string;
  startsAt: string;
  endsAt: string;
  region: string;
  discountPercent: number;
  billingUnits: string[];
  unitPriceUsdPer1kTokens: number | null;
};

/** Exact signed SKUs only. No new generation capability or customer price. */
export function signedBytePlusContractCost(input: BytePlusContractInput,
  list: { status: string; amountUsd: number | null; unitPriceUsdPer1kTokens: number | null }, at: string) {
  if (input.executionProvider !== 'byteplus_modelark' || input.accountContractRegion !== CONTRACT.region
    || input.step !== 'normal' || list.amountUsd == null || !list.status.startsWith('published_list')
    || !Number.isFinite(Date.parse(at))
    || Date.parse(at) < Date.parse(CONTRACT.startsAt) || Date.parse(at) >= Date.parse(CONTRACT.endsAt)) return null;
  let discountPercent: number;
  let billingUnits: string[];
  if (input.engineId === 'seedream') {
    if (!input.outputPixels?.length || input.inputImages == null) return null;
    discountPercent = 10;
    billingUnits = [`Seedream 5.0-Lite -Piece-${input.inputImages > 0 ? 'Edit' : 'Image'}`];
  } else if (input.engineId === 'seedream-5-0-pro') {
    if (!input.outputPixels?.length || input.inputImages == null || input.resolution.toLowerCase() !== '2k'
      || input.outputPixels.some(pixels => pixels > 4_556_800)) return null;
    discountPercent = 10;
    billingUnits = [...new Set(input.outputPixels.map(pixels => pixels <= 2_610_000
      ? 'Dola-Seedream-5.0-pro-output-lte-1.5k' : 'Dola-Seedream-5.0-pro-output-gt-1.5k-lte-2k'))];
    if (input.inputImages > 1) billingUnits.push('Dola-Seedream-5.0-Pro-input-image-Greater-than-1');
  } else {
    if (!input.billingInputType || list.unitPriceUsdPer1kTokens == null) return null;
    const inputClass = input.billingInputType === 'video_input' ? 'video-in' : 'non-video-in';
    const resolutions = input.engineId === 'seedance-2-0' ? ['480p', '720p', '1080p'] : ['480p', '720p'];
    if (!resolutions.includes(input.resolution)) return null;
    const model = {
      'seedance-2-0': { name: 'Dreamina-Seedance-2.0', discount: 0 },
      'seedance-2-0-fast': { name: 'Dreamina-Seedance-2.0-fast', discount: 50 },
      'seedance-2-0-mini': { name: 'Dreamina-Seedance-2.0-mini', discount: 60 },
      'seedance-2-5': { name: 'Dreamina-Seedance-2.5', discount: 0 },
    }[input.engineId];
    if (!model) return null;
    discountPercent = model.discount;
    billingUnits = [`${model.name}-inference-${inputClass}${input.engineId === 'seedance-2-5'
      ? '-480p-720p' : input.resolution === '1080p' ? '-1080p' : ''}`];
  }
  const multiplier = (100 - discountPercent) / 100;
  return {
    amountUsd: Number((list.amountUsd * multiplier).toFixed(6)),
    source: `Signed BytePlus order form ${CONTRACT.id} · before tax and credits`,
    confirmedAt: CONTRACT.startsAt,
    contract: { ...CONTRACT, discountPercent, billingUnits,
      unitPriceUsdPer1kTokens: list.unitPriceUsdPer1kTokens == null ? null
        : Number((list.unitPriceUsdPer1kTokens * multiplier).toFixed(9)) } satisfies BytePlusContractTerms,
  };
}
