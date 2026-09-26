import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { summarizeVercelMetric } from './vercel-metrics.mjs';

const { values } = parseArgs({ options: {
  since: { type: 'string' }, until: { type: 'string' }, deployment: { type: 'string' },
  out: { type: 'string' }, plan: { type: 'boolean', default: false },
} });
const now = new Date();
for (const field of ['since', 'until']) {
  if (!values[field] || !/^\d{4}-\d{2}-\d{2}T/.test(values[field]) || !Number.isFinite(Date.parse(values[field]))) {
    throw new Error('--since and --until must be explicit ISO timestamps, including timezone');
  }
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(values[field])) throw new Error('Timestamp timezone required');
}
if (Date.parse(values.since) >= Date.parse(values.until) || Date.parse(values.until) > now.getTime()) {
  throw new Error('Use an elapsed time window with since < until <= now');
}
if (values.deployment && !/^dpl_[A-Za-z0-9]+$/.test(values.deployment)) throw new Error('Invalid deployment ID');
const limit = 300;
const shared = ['--group-by', 'route', '--group-by', 'deviceType', '--since', values.since, '--until', values.until,
  '--limit', String(limit), '--project', 'maxvideoai', '--scope', 'camgraphes-projects', '--prod', '--json',
  '--filter', 'requestHostname:maxvideoai.com',
  ...(values.deployment ? ['--filter', 'deploymentId:' + values.deployment] : [])];
const queries = ['lcp_ms', 'inp_ms', 'cls', 'fcp_ms', 'ttfb_ms'].flatMap(metric => ['p75', 'count'].map(aggregation => ({
  metric, aggregation, args: ['metrics', 'vercel.speed_insights.' + metric, '--aggregation', aggregation, ...shared],
})));
if (values.plan) {
  console.log(JSON.stringify(queries, null, 2));
} else {
  const directory = resolve(values.out ?? join('.reports', 'vercel-cwv', now.toISOString().replace(/[:.]/g, '-')));
  // A capture is immutable: never overwrite a previous before/after directory.
  await mkdir(directory, { recursive: true });
  const manifest = { capturedAt: now.toISOString(), project: 'maxvideoai', hostname: 'maxvideoai.com', environment: 'production',
    requested: { since: values.since, until: values.until, deployment: values.deployment ?? null },
    status: 'collecting', files: [] };
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  const collected = new Map();
  try {
    for (const query of queries) {
      const { stdout } = await promisify(execFile)('vercel', query.args, { encoding: 'utf8', timeout: 60_000, maxBuffer: 25_000_000 });
      const data = JSON.parse(stdout);
      if (!data.query || !Array.isArray(data.summary)) throw new Error('Invalid Vercel response');
      const file = query.metric + '-' + query.aggregation + '.json';
      await writeFile(join(directory, file), stdout, { flag: 'wx' });
      collected.set(query.metric + '-' + query.aggregation, data);
      manifest.files.push({ file, command: ['vercel', ...query.args], actualQuery: data.query,
        possiblyTruncated: data.summary.length >= limit,
        windowAdjusted: Date.parse(data.query.startTime) !== Date.parse(values.since) || Date.parse(data.query.endTime) !== Date.parse(values.until) });
      console.log(file + ': ' + data.summary.length + ' groups');
    }
    const rows = ['lcp_ms', 'inp_ms', 'cls', 'fcp_ms', 'ttfb_ms'].flatMap(metric =>
      summarizeVercelMetric(metric, collected.get(metric + '-p75'), collected.get(metric + '-count')));
    await writeFile(join(directory, 'summary.json'), JSON.stringify(rows, null, 2) + '\n', { flag: 'wx' });
    manifest.status = 'complete';
    console.log('Saved ' + directory);
  } catch (error) {
    manifest.status = 'error';
    // Avoid printing a subprocess response that could include unrelated private data.
    console.error('Vercel capture incomplete. Inspect the archived files; do not use it as a complete baseline.');
    process.exitCode = 1;
  } finally {
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
}
