begin;

alter table profiles
  add column if not exists marketing_opt_in boolean,
  add column if not exists marketing_opt_in_at timestamptz,
  add column if not exists tos_version text,
  add column if not exists privacy_version text,
  add column if not exists cookies_version text,
  add column if not exists age_verified boolean,
  add column if not exists marked_for_deletion_at timestamptz;

commit;
