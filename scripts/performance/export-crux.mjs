import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { queryCrux } from './crux-client.mjs';

const { values } = parseArgs({ options: {
  history: { type: 'boolean', default: false },
  plan: { type: 'boolean', default: false },
  family: { type: 'string' },
  out: { type: 'string' },
} });
const matrix = JSON.parse(await readFile(new URL('./site-matrix.json', import.meta.url), 'utf8'));
const routes = matrix.routes.filter(route => !values.family || route.family === values.family);
if (!routes.length) throw new Error('No routes matched --family');
const targets = [
  { id: 'origin', family: 'all', scope: 'origin', target: matrix.origin },
  ...routes.map(route => ({ id: route.id, family: route.family, scope: 'url', target: new URL(route.path, matrix.origin).href })),
];
const queries = targets.flatMap(target => ['PHONE', 'DESKTOP'].map(formFactor => ({ ...target, formFactor })));
if (values.plan) {
  console.log(JSON.stringify({ mode: values.history ? 'history' : 'daily', queries }, null, 2));
} else {
  if (!process.env.CRUX_API_KEY) {
    console.error('Set CRUX_API_KEY locally for the Chrome UX Report API. No requests made. Use --plan to inspect coverage.');
    process.exitCode = 1;
  } else {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const directory = resolve(values.out ?? join('.reports', 'crux', stamp));
    await mkdir(directory, { recursive: true });
    const results = [];
    for (const query of queries) {
      const result = await queryCrux(query, { apiKey: process.env.CRUX_API_KEY, history: values.history });
      results.push(result);
      console.log([query.id, query.formFactor, result.status].join(' '));
    }
    // Includes raw Google records and requested/actual scope; never includes the credential.
    await writeFile(join(directory, 'records.json'), JSON.stringify(results, null, 2) + '\n', { flag: 'wx' });
    const csv = rows => rows.map(row => row.map(cell => '"' + String(cell ?? '').replaceAll('"', '""') + '"').join(',')).join('\n') + '\n';
    await writeFile(join(directory, 'coverage.csv'), csv([
      ['id','family','requestedScope','requestedTarget','formFactor','status','actualTarget','retrievedAt'],
      ...results.map(result => [result.requested.id,result.requested.family,result.requested.scope,result.requested.target,result.requested.formFactor,result.status,result.actualKey?.url ?? result.actualKey?.origin,result.retrievedAt]),
    ]), { flag: 'wx' });
    await writeFile(join(directory, 'metrics.csv'), csv([
      ['id','scope','target','formFactor','firstDate','lastDate','metric','unit','p75'],
      ...results.flatMap(result => result.rows.map(row => [result.requested.id,result.requested.scope,result.actualKey?.url ?? result.actualKey?.origin,result.requested.formFactor,row.firstDate,row.lastDate,row.metric,row.unit,row.p75])),
    ]), { flag: 'wx' });
    console.log('Saved ' + directory);
    if (results.some(result => !['ok','no-data'].includes(result.status))) process.exitCode = 1;
  }
}

