begin;

alter table if exists profiles
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists synced_from_supabase boolean not null default false;

commit;
