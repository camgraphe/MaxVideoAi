create extension if not exists "pgcrypto" with schema public;

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid,
  provider text not null,
  engine text not null,
  version text,
  prompt text not null,
  ratio text not null,
  duration_seconds integer not null,
  with_audio boolean not null default false,
  quantity integer not null default 1,
  preset_id text,
  cost_estimate_cents integer not null,
  cost_actual_cents integer,
  duration_actual_seconds integer,
  external_job_id text,
  output_url text,
  thumbnail_url text,
  archive_url text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  progress integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  status text not null,
  progress integer not null,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid references jobs(id) on delete cascade,
  meter text not null,
  quantity numeric not null,
  engine text not null,
  provider text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_meter_created on usage_events (meter, created_at desc);
create index if not exists idx_usage_events_org_created on usage_events (organization_id, created_at desc);
