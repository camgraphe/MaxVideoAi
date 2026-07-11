import { USD_TOPUP_TIERS } from '@/config/topupTiers';

export type InitialTopupSelection = {
  selectedTopupCents: number;
  customAmountInput: string;
};

const DEFAULT_TOPUP_CENTS = USD_TOPUP_TIERS[0]?.amountCents ?? 1000;

function formatCustomAmountInput(amountCents: number): string {
  const dollarAmount = Math.floor(amountCents / 100);
  const centRemainder = amountCents % 100;
  return centRemainder === 0
    ? String(dollarAmount)
    : `${dollarAmount}.${String(centRemainder).padStart(2, '0')}`;
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

export function createReturnedTopupSelection(
  amountCents: number | null
): InitialTopupSelection | null {
  if (!Number.isSafeInteger(amountCents) || Number(amountCents) < DEFAULT_TOPUP_CENTS) {
    return null;
  }
  return createInitialTopupSelection(Number(amountCents));
}
