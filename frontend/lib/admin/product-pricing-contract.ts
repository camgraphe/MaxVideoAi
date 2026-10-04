export type ProductPricingCategory = 'audio' | 'tools' | 'storyboard';
export type ProductPricingRow = {
  id: string;
  category: ProductPricingCategory;
  label: string;
  scenario: string;
  currency: string;
  totalCents: number | null;
  supplierCents: number | null;
  supplierBasis: 'catalogue' | 'budget' | 'unknown';
  quantity: number;
  unit: string;
  billingProductKey?: string;
  policySelector?: { engineId: string; mode?: string; resolution?: string };
  notes: string[];
};
export type ProductPricingInventory = { rows: ProductPricingRow[]; warnings: string[] };
