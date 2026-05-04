begin;

create table if not exists user_account_restrictions (
  user_id text primary key,
  active boolean not null default true,
  reason text not null,
  message text not null default 'Your account is temporarily restricted for security reasons. Please contact support.',
  restricted_at timestamptz not null default now(),
  restricted_by text,
  lifted_at timestamptz,
  lifted_by text,
  metadata jsonb
);

create index if not exists user_account_restrictions_active_idx
  on user_account_restrictions (active, restricted_at desc);

create table if not exists wallet_fraud_cleanup_audit (
  id bigserial primary key,
  user_id text not null,
  email text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_charge_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  previous_balance_cents integer not null check (previous_balance_cents >= 0),
  new_balance_cents integer not null check (new_balance_cents >= 0),
  action_taken text not null check (action_taken in ('credits_reversed','account_restricted')),
  admin_user_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_fraud_cleanup_audit_user_created_idx
  on wallet_fraud_cleanup_audit (user_id, created_at desc);

create unique index if not exists app_receipts_fraud_reversal_original_topup_unique
  on app_receipts ((metadata ->> 'original_topup_receipt_id'))
  where type = 'charge'
    and metadata ->> 'reason' = 'fraud_credit_reversal';

commit;
