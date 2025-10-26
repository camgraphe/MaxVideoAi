begin;

create table if not exists profiles (
  id uuid primary key,
  preferred_currency text,
  marketing_opt_in boolean,
  marketing_opt_in_at timestamptz,
  tos_version text,
  privacy_version text,
  cookies_version text,
  age_verified boolean,
  marked_for_deletion_at timestamptz
);

create index if not exists profiles_preferred_currency_idx on profiles (preferred_currency);

commit;
