import assert from 'node:assert/strict';

import { formatRateLimitMessage, formatRetryAfter } from '../frontend/app/(core)/billing/_lib/rate-limit-message';

assert.equal(formatRetryAfter(45), '45 s');
assert.equal(formatRetryAfter(900), '15 min');
assert.equal(formatRetryAfter(3600), '1 h');

assert.equal(
  formatRateLimitMessage('Trop de tentatives de paiement. Réessayez dans {time}.', 3600),
  'Trop de tentatives de paiement. Réessayez dans 1 h.'
);

assert.equal(
  formatRateLimitMessage('Too many payment attempts. Try again in {seconds}s.', 900),
  'Too many payment attempts. Try again in 15 min.'
);
