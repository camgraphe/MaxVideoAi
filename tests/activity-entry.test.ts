import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveActivityDestination } from '../frontend/app/(core)/jobs/_lib/activity-entry';
import type { GroupMemberSummary, GroupSummary } from '../frontend/types/groups';
import type { Job } from '../frontend/types/jobs';

function job(overrides: Partial<Job> = {}): Job {
  return {
    jobId: 'owned-job', surface: 'video', engineLabel: 'Fixture model', durationSec: 5,
    prompt: 'Fixture', createdAt: '2026-11-10T10:00:00.000Z', ...overrides,
  };
}

function member(value: Job): GroupMemberSummary {
  return {
    id: value.jobId, jobId: value.jobId, engineLabel: value.engineLabel,
    durationSec: value.durationSec, createdAt: value.createdAt, source: 'job', job: value,
  };
}

function group(...jobs: Job[]): GroupSummary {
  const members = jobs.map(member);
  return {
    id: 'batch-id-is-not-a-job', source: 'history', count: members.length,
    totalPriceCents: null, createdAt: jobs[0].createdAt, hero: members[0], members, previews: [],
  };
}

test('Activity resumes supported workspaces with the exact encoded owned job ID', () => {
  const cases = [
    ['video', 'create', '/app?job=owned%26job%3Fid%3D1'],
    ['image', 'image', '/app/image?job=owned%26job%3Fid%3D1'],
    ['audio', 'audio', '/app/audio?job=owned%26job%3Fid%3D1'],
    ['storyboard', 'storyboard', '/app/tools/storyboard?job=owned%26job%3Fid%3D1'],
    ['character', 'character', '/app/tools/character-builder?job=owned%26job%3Fid%3D1'],
  ] as const;
  for (const [surface, target, href] of cases) {
    assert.deepEqual(resolveActivityDestination(group(job({ jobId: 'owned&job?id=1', surface }))), {
      href, target, origin: null, resumesSettings: true,
    });
  }
});

test('Activity opens tools without unsupported job hydration parameters', () => {
  const cases = [
    ['angle', 'angle', '/app/tools/angle'],
    ['upscale', 'upscale', '/app/tools/upscale'],
    ['background-removal', 'background-removal', '/app/tools/background-removal'],
    ['tool', 'tools', '/app/tools'],
  ] as const;
  for (const [surface, target, href] of cases) {
    assert.deepEqual(resolveActivityDestination(group(job({ surface }))), {
      href, target, origin: null, resumesSettings: false,
    });
  }
});

test('Activity opens video upscale in its supported video tab', () => {
  for (const overrides of [{ settingsSnapshot: { mediaType: 'video' } }, { videoUrl: 'https://media.example/output.mp4' }]) {
    assert.deepEqual(resolveActivityDestination(group(job({ surface: 'upscale', ...overrides }))), {
      href: '/app/tools/upscale?kind=video', target: 'upscale', origin: null, resumesSettings: false,
    });
  }
});

test('Activity keeps historical Character and Angle evidence ahead of an image fallback', () => {
  assert.equal(resolveActivityDestination(group(job({ surface: 'video', settingsSnapshot: { surface: 'character-builder' } })))?.target, 'character');
  assert.equal(resolveActivityDestination(group(job({ surface: undefined, jobId: 'tool_angle_legacy' })))?.href, '/app/tools/angle');
  assert.equal(resolveActivityDestination(group(job({ surface: undefined, renderIds: ['https://media.example/image.png'] })))?.target, 'image');
});

test('Activity accepts only the server-projected origin and never infers MCP from request shape or IDs', () => {
  const value = job({ jobId: 'mcp-looking-id', settingsSnapshot: {
    schemaVersion: 1, source: 'mcp', origin: 'mcp', authOrigin: 'oauth',
    studioProjectId: 'invented', studio: { projectId: 'invented' },
  } });
  assert.deepEqual(resolveActivityDestination(group(value)), {
    href: '/app?job=mcp-looking-id', target: 'create', origin: null, resumesSettings: true,
  });
  assert.deepEqual(resolveActivityDestination(group(job({ activityOrigin: { kind: 'mcp' } }))), {
    href: '/app?job=owned-job', target: 'create', origin: 'mcp', resumesSettings: true,
  });
});

test('Activity returns a proven Studio project through its owned redirect', () => {
  assert.deepEqual(resolveActivityDestination(group(job({ activityOrigin: { kind: 'studio', projectId: 'project-123' } }))), {
    href: '/app/studio/workspace/project-123', target: 'studio', origin: 'studio', resumesSettings: false,
  });
});

test('Activity ignores malformed projected origins and unsafe Studio path segments', () => {
  const malformed = [
    null, [], 'mcp', { kind: 'MCP' }, { kind: 'studio' },
    ...['', ' ', '.', '..', '../other', '//host', 'project?redirect=elsewhere', 'project#fragment', '\\other', '\uD800', 'x'.repeat(129)]
      .map(projectId => ({ kind: 'studio', projectId })),
  ];
  for (const activityOrigin of malformed) {
    const value = job({ activityOrigin: activityOrigin as Job['activityOrigin'] });
    assert.deepEqual(resolveActivityDestination(group(value)), {
      href: '/app?job=owned-job', target: 'create', origin: null, resumesSettings: true,
    });
  }
});

test('Activity never substitutes a batch, member or local render ID for a missing owned job', () => {
  const value = group(job());
  const missing = { ...value.hero, job: undefined, jobId: undefined };
  assert.equal(resolveActivityDestination({ ...value, hero: missing, members: [missing] }), null);
  for (const jobId of ['', ' ', '\u0000', '\uD800', 'x'.repeat(257)]) {
    assert.equal(resolveActivityDestination(group(job({ jobId }))), null);
  }
  assert.equal(resolveActivityDestination(group(job({ curated: true }))), null);
});

test('Activity uses the hero job for an unambiguous batch and tolerates repeated output members', () => {
  const first = job({ jobId: 'first' });
  const second = job({ jobId: 'second' });
  const value = group(first, second);
  value.hero = value.members[1];
  assert.equal(resolveActivityDestination(value)?.href, '/app?job=second');
  assert.equal(resolveActivityDestination(group(first, first))?.href, '/app?job=first');
});

test('Activity does not choose a destination or origin for mixed batches', () => {
  const studio = job({ activityOrigin: { kind: 'studio', projectId: 'project-one' } });
  const cases = [
    [job(), job({ jobId: 'image', surface: 'image' })],
    [job(), job({ jobId: 'mcp', activityOrigin: { kind: 'mcp' } })],
    [studio, job({ jobId: 'plain' })],
    [studio, job({ jobId: 'other', activityOrigin: { kind: 'studio', projectId: 'project-two' } })],
    [job({ surface: 'upscale' }), job({ jobId: 'video', surface: 'upscale', settingsSnapshot: { mediaType: 'video' } })],
  ];
  for (const jobs of cases) assert.equal(resolveActivityDestination(group(...jobs)), null);
});

test('Activity permits mixed media in one proven Studio project', () => {
  const activityOrigin = { kind: 'studio', projectId: 'project-one' } as const;
  assert.equal(resolveActivityDestination(group(job({ activityOrigin }), job({ jobId: 'image', surface: 'image', activityOrigin })))?.href,
    '/app/studio/workspace/project-one');
});
