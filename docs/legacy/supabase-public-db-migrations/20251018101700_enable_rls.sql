-- Enable row level security on public tables exposed via PostgREST

alter table if exists public.presets enable row level security;
alter table if exists public.presets force row level security;

alter table if exists public.job_assets enable row level security;
alter table if exists public.job_assets force row level security;

alter table if exists public.job_events enable row level security;
alter table if exists public.job_events force row level security;

alter table if exists public.usage_snapshots enable row level security;
alter table if exists public.usage_snapshots force row level security;

alter table if exists public.users enable row level security;
alter table if exists public.users force row level security;

alter table if exists public.jobs enable row level security;
alter table if exists public.jobs force row level security;

alter table if exists public.organization_invites enable row level security;
alter table if exists public.organization_invites force row level security;

alter table if exists public.organization_members enable row level security;
alter table if exists public.organization_members force row level security;

alter table if exists public.organizations enable row level security;
alter table if exists public.organizations force row level security;

alter table if exists public.organization_credit_ledger enable row level security;
alter table if exists public.organization_credit_ledger force row level security;
