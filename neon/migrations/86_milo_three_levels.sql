-- Explicit migration. Add Standard/Terra without rewriting balances or financial history.
ALTER TABLE studio_assistance_accounts DROP CONSTRAINT studio_assistance_accounts_selected_model_check;
ALTER TABLE studio_assistance_accounts ADD CONSTRAINT studio_assistance_accounts_selected_model_check
  CHECK(selected_model IN ('gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'));
ALTER TABLE studio_assistance_turns DROP CONSTRAINT studio_assistance_turns_model_check;
ALTER TABLE studio_assistance_turns ADD CONSTRAINT studio_assistance_turns_model_check
  CHECK(model IN ('gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'));
