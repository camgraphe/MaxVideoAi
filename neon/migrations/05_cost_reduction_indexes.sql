begin;

do $$
begin
  if to_regclass('public.app_jobs') is not null then
    execute '
      create index if not exists app_jobs_user_created_idx
      on public.app_jobs (user_id, created_at desc)
      where user_id is not null
    ';

    execute '
      create index if not exists app_jobs_provider_job_idx
      on public.app_jobs (provider_job_id)
      where provider_job_id is not null
    ';

    execute '
      create index if not exists app_jobs_pending_poll_idx
      on public.app_jobs (updated_at asc)
      where provider_job_id is not null
        and status in (''pending'', ''queued'', ''running'', ''processing'', ''in_progress'')
    ';
  end if;
end $$;

do $$
begin
  if to_regclass('public.app_receipts') is not null then
    execute '
      create index if not exists app_receipts_job_type_created_idx
      on public.app_receipts (job_id, type, created_at desc)
      where job_id is not null
    ';
  end if;
end $$;

do $$
begin
  if to_regclass('public.fal_queue_log') is not null then
    execute '
      create index if not exists fal_queue_log_provider_job_created_idx
      on public.fal_queue_log (provider_job_id, created_at desc)
      where provider_job_id is not null
    ';
  end if;
end $$;

commit;
