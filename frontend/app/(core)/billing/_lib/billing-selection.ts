import { USD_TOPUP_TIERS } from '@/config/topupTiers';

export type InitialTopupSelection = {
  selectedTopupCents: number;
  customAmountInput: string;
};

const DEFAULT_TOPUP_CENTS = USD_TOPUP_TIERS[0]?.amountCents ?? 1000;

function formatCustomAmountInput(amountCents: number): string {
  return Number.isInteger(amountCents / 100)
    ? String(amountCents / 100)
    : (amountCents / 100).toFixed(2);
}

export function createInitialTopupSelection(
  amountCents: number | undefined
): InitialTopupSelection {
  const selectedTopupCents =
    Number.isSafeInteger(amountCents) && Number(amountCents) >= DEFAULT_TOPUP_CENTS
      ? Number(amountCents)
      : DEFAULT_TOPUP_CENTS;
  const isPreset = USD_TOPUP_TIERS.some(
    (entry) => entry.amountCents === selectedTopupCents
  );
  return {
    selectedTopupCents,
    customAmountInput: isPreset ? '' : formatCustomAmountInput(selectedTopupCents),
  };
}
