begin;

create table if not exists checkout_attempts (
  id bigserial primary key,
  user_id text not null,
  ip_hash text not null,
  amount_cents integer not null check (amount_cents >= 0),
  mode text not null check (mode in ('hosted','express_checkout')),
  outcome text not null default 'pending',
  captcha_required boolean not null default false,
  captcha_passed boolean not null default false,
  stripe_checkout_session_id text,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists checkout_attempts_user_created_idx
  on checkout_attempts (user_id, created_at desc);

create index if not exists checkout_attempts_ip_created_idx
  on checkout_attempts (ip_hash, created_at desc);

create index if not exists checkout_attempts_outcome_created_idx
  on checkout_attempts (outcome, created_at desc);

create index if not exists checkout_attempts_stripe_session_idx
  on checkout_attempts (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

commit;
