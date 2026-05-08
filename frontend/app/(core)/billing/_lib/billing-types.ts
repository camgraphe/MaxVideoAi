export type ReceiptItem = {
  id: number;
  type: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  created_at: string;
  job_id: string | null;
  surface?: string | null;
  billing_product_key?: string | null;
  tax_amount_cents: number | null;
  discount_amount_cents: number | null;
  document_type?: 'invoice' | 'receipt' | null;
  document_label?: string | null;
  document_url?: string | null;
};

export type MembershipTierInfo = {
  tier: string;
  spendThresholdCents: number;
  discountPercent: number;
};

export type MemberStatus = {
  tier: string;
  savingsPct?: number;
  spent30?: number;
  spentToday?: number;
  mock?: boolean;
  tiers?: MembershipTierInfo[];
};

export type BillingSession = {
  access_token?: string | null;
  user?: {
    id?: string | null;
  } | null;
} | null;

export type TopupQuote = {
  amountMinor: number;
  currency: string;
};

export type ReceiptsState = {
  items: ReceiptItem[];
  nextCursor: string | null;
  loading: boolean;
  error?: string | null;
};
