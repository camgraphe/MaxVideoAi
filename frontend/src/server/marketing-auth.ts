export type MarketingAuthSnapshot = {
  email: string | null;
  isAdmin: boolean;
};

export async function getMarketingAuthSnapshot(): Promise<MarketingAuthSnapshot> {
  return { email: null, isAdmin: false };
}
