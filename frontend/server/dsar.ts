import { query } from '@/lib/db';
import { getProfileSnapshot, type ProfileSnapshot } from '@/server/profile';
import { getUserIdentity } from '@/server/supabase-admin';

type PreferenceRow = {
  default_share_public: boolean;
  default_allow_index: boolean;
  onboarding_done: boolean;
  updated_at: Date | null;
};

type ReceiptRow = {
  id: string;
  type: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  metadata: unknown;
  job_id: string | null;
  pricing_snapshot: unknown;
  application_fee_cents: number | null;
  vendor_account_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_refund_id: string | null;
  created_at: Date;
};

type ConsentRow = {
  doc_key: string;
  doc_version: string;
  accepted: boolean;
  accepted_at: Date;
  ip: string | null;
  user_agent: string | null;
  locale: string | null;
  source: string | null;
};

export type DsraExportPayload = {
  generatedAt: string;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    profile: ReturnType<typeof mapProfile> | null;
    preferences: PreferenceRow | null;
  };
  receipts: ReceiptRow[];
  consents: ConsentRow[];
};

function mapProfile(profile: ProfileSnapshot | null): {
  marketingOptIn: boolean | null;
  marketingOptInAt: string | null;
  tosVersion: string | null;
  privacyVersion: string | null;
  cookiesVersion: string | null;
  ageVerified: boolean | null;
  markedForDeletionAt: string | null;
} {
  if (!profile) {
    return {
      marketingOptIn: null,
      marketingOptInAt: null,
      tosVersion: null,
      privacyVersion: null,
      cookiesVersion: null,
      ageVerified: null,
      markedForDeletionAt: null,
    };
  }
  return {
    marketingOptIn: profile.marketingOptIn ?? null,
    marketingOptInAt: profile.marketingOptInAt ? profile.marketingOptInAt.toISOString() : null,
    tosVersion: profile.tosVersion ?? null,
    privacyVersion: profile.privacyVersion ?? null,
    cookiesVersion: profile.cookiesVersion ?? null,
    ageVerified: profile.ageVerified ?? null,
    markedForDeletionAt: profile.markedForDeletionAt ? profile.markedForDeletionAt.toISOString() : null,
  };
}

export async function buildDsarPayload(userId: string): Promise<DsraExportPayload> {
  const [profile, preferencesRows, receipts, consents, identity] = await Promise.all([
    getProfileSnapshot(userId),
    query<PreferenceRow>(
      `SELECT default_share_public, default_allow_index, onboarding_done, updated_at
       FROM user_preferences
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    ),
    query<ReceiptRow>(
      `SELECT id, type, amount_cents, currency, description, metadata, job_id, pricing_snapshot,
              application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id,
              stripe_refund_id, created_at
       FROM app_receipts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    ),
    query<ConsentRow>(
      `SELECT doc_key, doc_version, accepted, accepted_at, ip::text, user_agent, locale, source
       FROM user_consents
       WHERE user_id = $1
       ORDER BY accepted_at DESC`,
      [userId]
    ),
    getUserIdentity(userId),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    user: {
      id: userId,
      email: identity?.email ?? null,
      fullName: identity?.fullName ?? null,
      profile: mapProfile(profile),
      preferences: preferencesRows[0] ?? null,
    },
    receipts,
    consents,
  };
}
