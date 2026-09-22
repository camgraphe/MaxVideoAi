import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { JobFilters } from '../frontend/app/(core)/admin/jobs/_components/JobFilters';
import { normalizeFilters } from '../frontend/app/(core)/admin/jobs/_lib/admin-jobs-helpers';

Object.assign(globalThis, { React });

test('advanced generation filters reveal active values and remain in the submitted form when collapsed', () => {
  const filters = normalizeFilters({ userId: 'user-123', outcome: 'refunded_failure_resolved', from: '2026-09-01', to: '2026-09-22' });
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(JobFilters, { filters })));
  try {
    const details = dom.window.document.querySelector('details');
    assert.ok(details, 'advanced filters must have a disclosure');
    assert.equal(details.open, true, 'an active advanced filter must not be hidden on arrival');
    details.open = false;
    const data = new dom.window.FormData(dom.window.document.querySelector('form')!);
    assert.equal(data.get('userId'), 'user-123');
    assert.equal(data.get('from'), '2026-09-01');
    assert.equal(data.get('to'), '2026-09-22');
    assert.equal(data.get('outcome'), 'refunded_failure_resolved');
  } finally { dom.window.close(); }
});

test('generation filter disclosure starts closed when advanced filters are unused', () => {
  const filters = normalizeFilters({ jobId: 'job-123', status: 'completed' });
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(JobFilters, { filters })));
  try {
    const details = dom.window.document.querySelector('details');
    assert.ok(details);
    assert.equal(details.open, false);
    const data = new dom.window.FormData(dom.window.document.querySelector('form')!);
    assert.equal(data.get('jobId'), 'job-123');
    assert.equal(data.get('status'), 'completed');
  } finally { dom.window.close(); }
});
