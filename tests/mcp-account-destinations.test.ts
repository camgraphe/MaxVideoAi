import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAgentAccountDestinations,
  buildAgentGenerationDestination,
} from '../frontend/src/server/agent-api/account-destinations';

test('account destinations keep every customer handoff on the production MaxVideoAI origin', () => {
  const destinations = buildAgentAccountDestinations(
    'https://maxvideoai.com/account/connections',
  );

  assert.deepEqual(destinations, {
    connections: {
      type: 'open_url',
      purpose: 'account_connections',
      label: 'Manage the MaxVideoAI connection',
      url: 'https://maxvideoai.com/account/connections',
    },
    billing: {
      type: 'open_url',
      purpose: 'billing',
      label: 'Add MaxVideoAI credits',
      url: 'https://maxvideoai.com/billing',
    },
    library: {
      type: 'open_url',
      purpose: 'media_library',
      label: 'Open the MaxVideoAI media library',
      url: 'https://maxvideoai.com/app/library',
    },
    videoWorkspace: {
      type: 'open_url',
      purpose: 'video_workspace',
      label: 'Open the MaxVideoAI video workspace',
      url: 'https://maxvideoai.com/app',
    },
    imageWorkspace: {
      type: 'open_url',
      purpose: 'image_workspace',
      label: 'Open the MaxVideoAI image workspace',
      url: 'https://maxvideoai.com/app/image',
    },
    support: {
      type: 'open_url',
      purpose: 'support',
      label: 'Contact MaxVideoAI support',
      url: 'https://maxvideoai.com/contact',
    },
  });
});

test('account destinations preserve the official staging and loopback origins', () => {
  assert.equal(
    buildAgentAccountDestinations(
      'https://maxvideoai-mcp-staging.vercel.app/account/connections',
    ).library.url,
    'https://maxvideoai-mcp-staging.vercel.app/app/library',
  );
  assert.equal(
    buildAgentAccountDestinations(
      'http://127.0.0.1:3000/account/connections',
    ).billing.url,
    'http://127.0.0.1:3000/billing',
  );
  assert.equal(
    buildAgentAccountDestinations(
      'https://localhost:62453/account/connections',
    ).support.url,
    'https://localhost:62453/contact',
  );
});

test('account destinations reject URLs that can redirect a customer outside the trusted account origin', () => {
  const rejected = [
    'https://user:password@maxvideoai.com/account/connections',
    'https://maxvideoai.com/account/connections?next=https://example.com',
    'https://maxvideoai.com/account/connections#token',
    'ftp://maxvideoai.com/account/connections',
    'http://maxvideoai.com/account/connections',
    'https://maxvideoai.com:444/account/connections',
    'https://example.com/account/connections',
    'https://maxvideoai-mcp-staging.vercel.app.evil.example/account/connections',
    'https://maxvideoai.com/account/connections/elsewhere',
    ' https://maxvideoai.com/account/connections ',
  ];

  for (const value of rejected) {
    assert.throws(() => buildAgentAccountDestinations(value), /trusted MaxVideoAI account URL/);
  }
});

test('generation destinations encode owned job IDs as query data instead of path construction', () => {
  assert.deepEqual(
    buildAgentGenerationDestination(
      'https://maxvideoai.com/account/connections',
      'video',
      'job/id?next=/billing',
    ),
    {
      type: 'open_url',
      purpose: 'generation',
      label: 'Open this video in MaxVideoAI',
      url: 'https://maxvideoai.com/app?job=job%2Fid%3Fnext%3D%2Fbilling',
    },
  );
  assert.equal(
    buildAgentGenerationDestination(
      'https://maxvideoai-mcp-staging.vercel.app/account/connections',
      'image',
      'image-job-1',
    ).url,
    'https://maxvideoai-mcp-staging.vercel.app/app/image?job=image-job-1',
  );
  assert.throws(
    () => buildAgentGenerationDestination(
      'https://maxvideoai.com/account/connections',
      'video',
      '   ',
    ),
    /valid owned job ID/,
  );
});
