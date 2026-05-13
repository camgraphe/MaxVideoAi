import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx',
  'utf8'
);

assert.match(
  source,
  /const labelsRef = useRef\(labels\)/,
  'Express Checkout should keep labels in a ref so parent rerenders do not remount Stripe'
);

assert.match(
  source,
  /const handlersRef = useRef\(\{\s*onCaptchaRequired,\s*onPaymentFailed,\s*onPaymentStarted,\s*\}\)/,
  'Express Checkout should keep callbacks in a ref so parent rerenders do not remount Stripe'
);

const dependencyBlocks = [...source.matchAll(/\}, \[\n([\s\S]*?)\n  \]\);/g)].map((match) => match[1]);
const mountEffectDependencies = dependencyBlocks.find((block) => block.includes('amountCents')) ?? '';

assert.doesNotMatch(
  mountEffectDependencies,
  /labels\.|onCaptchaRequired|onPaymentFailed|onPaymentStarted/,
  'Express Checkout mount effect should not depend on unstable labels or callbacks'
);

assert.match(
  source,
  /params\.set\('checkoutSessionId', checkoutSessionResult\.sessionId\)/,
  'Express Checkout success redirects should keep the Stripe Checkout Session id for funnel reporting'
);
