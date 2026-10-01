-- Final completion is distinct from a paid, retained Draft. Failed attempts
-- remain app_jobs/receipt history even when a fully refunded link is released.
ALTER TABLE seedance_draft_links DROP CONSTRAINT IF EXISTS seedance_draft_links_final_state_check;
ALTER TABLE seedance_draft_links ADD CONSTRAINT seedance_draft_links_final_state_check
  CHECK (final_state IN ('none', 'reserved', 'submitted', 'completed', 'failed'));
