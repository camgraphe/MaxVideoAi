# MCP trial risk-event retention

MCP trial risk events are limited to a fixed maximum retention of 30 days for
fraud prevention, velocity enforcement, and provider-cost budget protection.
Only the coarse HMAC fingerprint and allowlisted accounting fields are stored;
raw IP addresses, user-agent strings, prompts, URLs, tokens, and emails must
never be persisted.

Task 8 owns the bounded cleanup schedule. It must delete events older than the
30-day maximum through `cleanup_mcp_trial_risk_events`; Task 4 does not install
or operate a cron job.

Rotate `MCP_TRIAL_RISK_SECRET` through deployment configuration and restart the
service. A rotation intentionally changes future fingerprints without requiring
raw client data to be retained.
