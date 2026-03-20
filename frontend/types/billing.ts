export const JOB_SURFACE_VALUES = ['video', 'image', 'character', 'angle', 'audio'] as const;

export type JobSurface = (typeof JOB_SURFACE_VALUES)[number];

export const USER_ASSET_SOURCE_VALUES = ['upload', 'generated', 'character', 'angle'] as const;

export type UserAssetSource = (typeof USER_ASSET_SOURCE_VALUES)[number];

export const BILLING_PRODUCT_UNIT_KIND_VALUES = ['image', 'run'] as const;

export type BillingProductUnitKind = (typeof BILLING_PRODUCT_UNIT_KIND_VALUES)[number];

export type BillingProductKey = string;

export type BillingProductRecord = {
  productKey: BillingProductKey;
  surface: JobSurface;
  label: string;
  currency: string;
  unitKind: BillingProductUnitKind;
  unitPriceCents: number;
  active: boolean;
  metadata?: Record<string, unknown> | null;
};
