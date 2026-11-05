-- Reply storage only. No task allowance, token bound, tariff or consent changes.
-- Apply explicitly before the runtime; old deployments remain compatible.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $$
BEGIN
  IF to_regclass('public.studio_tasks') IS NULL THEN
    RAISE EXCEPTION 'Apply Studio task migration 65 before the reply envelope';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.studio_tasks'::regclass
    AND ((conname='studio_tasks_partial_reply_check' AND pg_get_expr(conbin,conrelid) IS DISTINCT FROM '(length(partial_reply) <= 2400)')
      OR (conname='studio_tasks_reply_envelope_v1' AND pg_get_expr(conbin,conrelid) IS DISTINCT FROM '(length(partial_reply) <= 50000)'))) THEN
    RAISE EXCEPTION 'Unrecognized Studio reply constraint; inspect before migration';
  END IF;
END;
$$;

ALTER TABLE public.studio_tasks DROP CONSTRAINT IF EXISTS studio_tasks_partial_reply_check;
ALTER TABLE public.studio_tasks DROP CONSTRAINT IF EXISTS studio_tasks_reply_envelope_v1;
ALTER TABLE public.studio_tasks ADD CONSTRAINT studio_tasks_reply_envelope_v1
  CHECK(length(partial_reply)<=50000) NOT VALID;
ALTER TABLE public.studio_tasks VALIDATE CONSTRAINT studio_tasks_reply_envelope_v1;
