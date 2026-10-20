-- Apply before delivering the guard that claims Turnstile tokens.
-- Only SHA-256 fingerprints are retained; no token or widget secret is stored.
-- A claim survives a downstream Stripe/session failure and is global across users.
begin;

create unique index if not exists checkout_attempts_turnstile_token_once_idx
  on checkout_attempts ((metadata ->> 'turnstileTokenHash'))
  where captcha_passed is true and metadata ? 'turnstileTokenHash';

commit;
