-- New accounts use included Luna. Explicit Sol choices and frozen turns retain their identity.
ALTER TABLE studio_assistance_accounts ALTER COLUMN selected_model SET DEFAULT 'gpt-6-luna';

UPDATE studio_assistance_accounts AS account
SET selected_model='gpt-6-luna', revision=revision+1, updated_at=clock_timestamp()
WHERE selected_model='gpt-6.1-sol' AND paid_enabled=false
  AND NOT EXISTS (
    SELECT 1 FROM studio_assistance_choices AS choice
    WHERE choice.user_id=account.user_id
      AND choice.action IN ('select_sol','authorize_paid','purchase_pack','resume_paid')
  );
