// Illustrative design units only. This is not an application tariff or ledger.
export const DEMO_CREDITS_PER_DOLLAR = 1000;
export const DEMO_PACK_PRICES = [2, 5, 10] as const;
export const PROPOSED_ASSISTANCE_MARKUP_PERCENT = 100;
export type DemoCreditPack = {id: number; dollars: number; total: number; remaining: number};
export type DemoCreditWallet = {included: {total: number; remaining: number}; packs: DemoCreditPack[]};

/** Whole-cent supplier basis for this local example; production rounding is unchanged. */
export function quoteDemoCreditUsage(supplierBasisCents: number) {
  if (!Number.isSafeInteger(supplierBasisCents) || supplierBasisCents < 0) throw new Error('INVALID_DEMO_COST');
  const customerCents = supplierBasisCents * (1 + PROPOSED_ASSISTANCE_MARKUP_PERCENT / 100);
  const credits = customerCents * DEMO_CREDITS_PER_DOLLAR / 100;
  if (!Number.isSafeInteger(credits)) throw new Error('INVALID_DEMO_COST');
  return {supplierBasisCents, customerCents, credits};
}

export function createDemoCreditWallet(): DemoCreditWallet {
  return {included: {total: 200, remaining: 144}, packs: [{id: 1, dollars: 2, total: 2000, remaining: 1280}]};
}

export function demoPurchasedBalance(wallet: DemoCreditWallet) {
  return wallet.packs.reduce((sum, pack) => ({total: sum.total + pack.total, remaining: sum.remaining + pack.remaining}), {total: 0, remaining: 0});
}

export function addDemoCreditPack(wallet: DemoCreditWallet, dollars: number): DemoCreditWallet {
  if (!DEMO_PACK_PRICES.some(price => price === dollars)) throw new Error('INVALID_DEMO_PACK');
  const total = dollars * DEMO_CREDITS_PER_DOLLAR;
  const id = Math.max(0, ...wallet.packs.map(pack => pack.id)) + 1;
  return {...wallet, packs: [...wallet.packs, {id, dollars, total, remaining: total}]};
}

export function consumeDemoCredits(wallet: DemoCreditWallet, requested: number) {
  if (!Number.isSafeInteger(requested) || requested <= 0) throw new Error('INVALID_DEMO_USAGE');
  const includedUsed = Math.min(requested, wallet.included.remaining);
  let outstanding = requested - includedUsed;
  // Free allowance first, then purchased packs in purchase order.
  const packs = wallet.packs.map(pack => {
    const used = Math.min(outstanding, pack.remaining);
    outstanding -= used;
    return {...pack, remaining: pack.remaining - used};
  });
  return {
    wallet: {included: {...wallet.included, remaining: wallet.included.remaining - includedUsed}, packs},
    includedUsed, purchasedUsed: requested - includedUsed - outstanding, unfulfilled: outstanding,
  };
}
