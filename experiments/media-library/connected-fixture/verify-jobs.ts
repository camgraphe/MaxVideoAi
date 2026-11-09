/** Read actual HTTP owners after the guarded synthetic-job setup. No browser. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
async function main() {
  const connection = JSON.parse(await readFile(resolve(process.argv[2] ?? '.superpowers/sdd/2026-11-09-media-library-integration/task-8-connection.json'), 'utf8'));
  for (const origin of [connection.origin, connection.controlOrigin]) assert.equal(new URL(origin).hostname, '127.0.0.1');
  const minted = await fetch(connection.controlOrigin + '/session/mint', { method: 'POST', headers: {
    Authorization: `Bearer ${connection.controlToken}`, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ account: 'a' }) });
  assert.equal(minted.status, 200);
  const session = await minted.json();
  assert.equal(new URL(session.entry).origin, connection.origin);
  const bootstrap = await fetch(session.entry, { redirect: 'manual' });
  assert.equal(bootstrap.status, 307);
  const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const results = [];
  for (const path of ['/api/jobs?limit=30', '/api/jobs?surface=audio', '/api/jobs?surface=video&limit=60', '/api/jobs/fixture-job-0', '/api/jobs/fixture-job-0/seedance-workflow']) {
    const response = await fetch(connection.origin + path, { headers: { Cookie: cookie } });
    const body = await response.json();
    assert.equal(response.status, path.endsWith('seedance-workflow') ? 404 : 200);
    if (body.jobs) {
      assert.equal(body.jobs.length, path.includes('surface=audio') ? 1 : path.includes('surface=video') ? 2 : 12);
      assert.ok(body.jobs.every((job: any) => job.settingsSnapshot && Object.keys(job.settingsSnapshot).length));
      if (path.includes('surface=video')) assert.ok(body.jobs.every((job: any) => typeof job.videoUrl === 'string' && job.videoUrl.length));
    } else if (!path.endsWith('seedance-workflow')) assert.ok(Object.keys(body.settingsSnapshot).length);
    results.push({ path, status: response.status, jobs: body.jobs?.map((job: any) => ({ jobId: job.jobId, surface: job.surface, hasSettings: Boolean(job.settingsSnapshot) })), settingsKeys: body.settingsSnapshot ? Object.keys(body.settingsSnapshot) : undefined });
  }
  await writeFile(join(connection.runDir, 'jobs-http.json'), JSON.stringify({ source: connection.revision, bootstrap: bootstrap.status, results }, null, 2));
  console.log(JSON.stringify({ source: connection.revision, statuses: results.map(result => result.status), jobs: results[0].jobs.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
