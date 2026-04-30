-- Harden public schema tables reported by Supabase Security Advisor.
-- The app currently uses Supabase for Auth and server-side DATABASE_URL tables
-- for production render/wallet flows, so only non-sensitive presets remain
-- readable by anon clients.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_user_is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organization_members om
     where om.organization_id = target_org_id
       and om.user_id = auth.uid()
  );
$$;

create or replace function private.current_user_is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organization_members om
     where om.organization_id = target_org_id
       and om.user_id = auth.uid()
       and om.role in ('owner'::public.org_role, 'admin'::public.org_role)
  );
$$;

revoke all on function private.current_user_is_org_member(uuid) from public;
revoke all on function private.current_user_is_org_admin(uuid) from public;
revoke all on function private.current_user_is_org_member(uuid) from anon;
revoke all on function private.current_user_is_org_admin(uuid) from anon;
grant execute on function private.current_user_is_org_member(uuid) to authenticated;
grant execute on function private.current_user_is_org_admin(uuid) to authenticated;

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

revoke all on public.presets from anon, authenticated;
revoke all on public.job_assets from anon, authenticated;
revoke all on public.job_events from anon, authenticated;
revoke all on public.usage_snapshots from anon, authenticated;
revoke all on public.users from anon, authenticated;
revoke all on public.jobs from anon, authenticated;
revoke all on public.organization_invites from anon, authenticated;
revoke all on public.organization_members from anon, authenticated;
revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_credit_ledger from anon, authenticated;

grant select on public.presets to anon, authenticated;
grant select, insert, update on public.users to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update on public.jobs to authenticated;
grant select, insert on public.job_assets to authenticated;
grant select, insert on public.job_events to authenticated;
grant select on public.usage_snapshots to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant insert, update, delete on public.organization_invites to authenticated;
grant select on public.organization_credit_ledger to authenticated;

drop policy if exists "presets are publicly readable" on public.presets;
create policy "presets are publicly readable"
  on public.presets
  for select
  to anon, authenticated
  using (true);

drop policy if exists "users can read own profile" on public.users;
create policy "users can read own profile"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users can insert own profile" on public.users;
create policy "users can insert own profile"
  on public.users
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.users;
create policy "users can update own profile"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "members can read their organizations" on public.organizations;
create policy "members can read their organizations"
  on public.organizations
  for select
  to authenticated
  using (private.current_user_is_org_member(public.organizations.id));

drop policy if exists "org admins can update organizations" on public.organizations;
create policy "org admins can update organizations"
  on public.organizations
  for update
  to authenticated
  using (private.current_user_is_org_admin(public.organizations.id))
  with check (private.current_user_is_org_admin(public.organizations.id));

drop policy if exists "members can read organization memberships" on public.organization_members;
create policy "members can read organization memberships"
  on public.organization_members
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or private.current_user_is_org_member(public.organization_members.organization_id)
  );

drop policy if exists "org admins can insert memberships" on public.organization_members;
create policy "org admins can insert memberships"
  on public.organization_members
  for insert
  to authenticated
  with check (private.current_user_is_org_admin(public.organization_members.organization_id));

drop policy if exists "org admins can update memberships" on public.organization_members;
create policy "org admins can update memberships"
  on public.organization_members
  for update
  to authenticated
  using (private.current_user_is_org_admin(public.organization_members.organization_id))
  with check (private.current_user_is_org_admin(public.organization_members.organization_id));

drop policy if exists "org admins can delete memberships" on public.organization_members;
create policy "org admins can delete memberships"
  on public.organization_members
  for delete
  to authenticated
  using (private.current_user_is_org_admin(public.organization_members.organization_id));

drop policy if exists "members can read organization jobs" on public.jobs;
create policy "members can read organization jobs"
  on public.jobs
  for select
  to authenticated
  using (
    auth.uid() = created_by
    or private.current_user_is_org_member(public.jobs.organization_id)
  );

drop policy if exists "members can insert own jobs" on public.jobs;
create policy "members can insert own jobs"
  on public.jobs
  for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and private.current_user_is_org_member(public.jobs.organization_id)
  );

drop policy if exists "job owners and org admins can update jobs" on public.jobs;
create policy "job owners and org admins can update jobs"
  on public.jobs
  for update
  to authenticated
  using (
    auth.uid() = created_by
    or private.current_user_is_org_admin(public.jobs.organization_id)
  )
  with check (
    auth.uid() = created_by
    or private.current_user_is_org_admin(public.jobs.organization_id)
  );

drop policy if exists "members can read job assets" on public.job_assets;
create policy "members can read job assets"
  on public.job_assets
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.jobs
       where public.jobs.id = public.job_assets.job_id
         and private.current_user_is_org_member(public.jobs.organization_id)
    )
  );

drop policy if exists "job owners can insert job assets" on public.job_assets;
create policy "job owners can insert job assets"
  on public.job_assets
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.jobs
       where public.jobs.id = public.job_assets.job_id
         and public.jobs.created_by = auth.uid()
    )
  );

drop policy if exists "members can read job events" on public.job_events;
create policy "members can read job events"
  on public.job_events
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.jobs
       where public.jobs.id = public.job_events.job_id
         and private.current_user_is_org_member(public.jobs.organization_id)
    )
  );

drop policy if exists "job owners can insert job events" on public.job_events;
create policy "job owners can insert job events"
  on public.job_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.jobs
       where public.jobs.id = public.job_events.job_id
         and public.jobs.created_by = auth.uid()
    )
  );

drop policy if exists "members can read usage snapshots" on public.usage_snapshots;
create policy "members can read usage snapshots"
  on public.usage_snapshots
  for select
  to authenticated
  using (private.current_user_is_org_member(public.usage_snapshots.organization_id));

drop policy if exists "org admins can insert invites" on public.organization_invites;
create policy "org admins can insert invites"
  on public.organization_invites
  for insert
  to authenticated
  with check (private.current_user_is_org_admin(public.organization_invites.organization_id));

drop policy if exists "org admins can update invites" on public.organization_invites;
create policy "org admins can update invites"
  on public.organization_invites
  for update
  to authenticated
  using (private.current_user_is_org_admin(public.organization_invites.organization_id))
  with check (private.current_user_is_org_admin(public.organization_invites.organization_id));

drop policy if exists "org admins can delete invites" on public.organization_invites;
create policy "org admins can delete invites"
  on public.organization_invites
  for delete
  to authenticated
  using (private.current_user_is_org_admin(public.organization_invites.organization_id));

drop policy if exists "members can read credit ledger" on public.organization_credit_ledger;
create policy "members can read credit ledger"
  on public.organization_credit_ledger
  for select
  to authenticated
  using (private.current_user_is_org_member(public.organization_credit_ledger.organization_id));

drop function if exists public.current_user_is_org_member(uuid);
drop function if exists public.current_user_is_org_admin(uuid);

commit;
