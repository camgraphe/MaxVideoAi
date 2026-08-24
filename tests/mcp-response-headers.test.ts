import assert from 'node:assert/strict';
import test from 'node:test';

import { withMcpNoindexHeaders } from '../frontend/src/server/mcp/response-headers';

test('hosted staging MCP responses retain the full noarchive policy', { concurrency: false }, () => {
  const original = process.env.MCP_STAGING_ENABLED;
  process.env.MCP_STAGING_ENABLED = 'true';

  try {
    const headers = withMcpNoindexHeaders();
    assert.equal(headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  } finally {
    if (original === undefined) delete process.env.MCP_STAGING_ENABLED;
    else process.env.MCP_STAGING_ENABLED = original;
  }
});

test('non-staging MCP responses keep the established noindex policy', { concurrency: false }, () => {
  const original = process.env.MCP_STAGING_ENABLED;
  delete process.env.MCP_STAGING_ENABLED;

  try {
    const headers = withMcpNoindexHeaders();
    assert.equal(headers.get('x-robots-tag'), 'noindex, nofollow');
  } finally {
    if (original === undefined) delete process.env.MCP_STAGING_ENABLED;
    else process.env.MCP_STAGING_ENABLED = original;
  }
});
