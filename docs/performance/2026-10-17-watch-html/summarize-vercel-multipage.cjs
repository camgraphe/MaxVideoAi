const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const report = __dirname;
const protocol = JSON.parse(fs.readFileSync(path.join(report, 'multipage-protocol.json')));
const input = path.resolve(process.env.WATCH_HTML_MULTIPAGE_INPUT ?? '.reports/watch-html-lcp-20261017');
const median = values => {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const samples = [], groups = [], paired = [];
const metrics = ['ttfb', 'htmlEndMs', 'posterRequestStartMs', 'posterFetchMs', 'fcp', 'lcp', 'cls', 'tbt', 'bytes'];
const collections = [
  ...protocol.routes.map(item => ({...item, collection: 'initial', folder: 'browser-vercel-' + item.key, repeats: 3, devices: ['desktop', 'mobile'], temperatures: ['cold', 'warm']})),
  {key: 'minimax', route: protocol.targetedFollowup.route, collection: 'tail-followup', folder: 'browser-vercel-minimax-desktop-followup', repeats: 6, devices: ['desktop'], temperatures: ['cold']},
  {key: 'kling', route: protocol.klingImageCacheFollowup.route, collection: 'image-cache-followup', folder: 'browser-vercel-kling-cache-followup', repeats: 3, devices: ['desktop'], temperatures: ['cold']},
];
for (const {key, route, collection, folder, repeats, devices, temperatures} of collections) {
  const directory = path.join(input, folder);
  const raw = JSON.parse(fs.readFileSync(path.join(directory, 'samples.json')));
  assert.equal(raw.length, 2 * repeats * devices.length * temperatures.length, key + ': complete predefined series required');
  assert.equal(new Set(raw.map(row => row.id)).size, raw.length);
  for (const row of raw) {
    assert.equal(row.route, route);
    assert.equal(row.origin, protocol.source[row.side].origin);
    const lhr = JSON.parse(fs.readFileSync(path.join(directory, row.id + '.lhr.json')));
    assert.equal(lhr.runtimeError, undefined);
    assert.deepEqual(lhr.configSettings, protocol.profiles[row.device], 'same complete Lighthouse configuration as the original matched comparison');
    assert.equal(lhr.runWarnings.length, 0);
    assert.equal(/Android|Mobile/.test(lhr.configSettings.emulatedUserAgent), row.device === 'mobile');
    assert.equal(/Android|Mobile/.test(lhr.environment.networkUserAgent), row.device === 'mobile');
    const requests = lhr.audits['network-requests'].details.items;
    const document = requests.find(item => item.resourceType === 'Document');
    assert.equal(document.statusCode, 200);
    const posterUrl = new URL(row.reader.video.poster, row.origin).href;
    const poster = requests.find(item => item.url === posterUrl && item.resourceType === 'Image');
    // Warm browser audits may read the poster without a network request. Keep null explicit.
    const lcpNode = lhr.audits['lcp-phases-insight'].details.items.find(item => item.type === 'node');
    assert.ok(lcpNode?.selector);
    const phases = lhr.audits['lcp-phases-insight'].details.items.find(item => item.type === 'table')?.items ?? [];
    const events = JSON.parse(fs.readFileSync(path.join(directory, row.id + '.devtools.json')));
    const imageResponse = events.find(item => item.method === 'Network.responseReceived' && item.params.type === 'Image' && item.params.response.url === posterUrl)?.params.response;
    const imageHeaders = Object.fromEntries(Object.entries(imageResponse?.headers ?? {}).map(([k,v]) => [k.toLowerCase(),v]));
    if (collection !== 'initial') assert.equal(imageHeaders['x-vercel-cache'], 'HIT', 'targeted follow-ups require matching warm image caches');
    const headers = Object.fromEntries(Object.entries(row.documentResponse ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    for (const metric of ['ttfb', 'fcp', 'lcp', 'cls', 'tbt', 'bytes']) assert.ok(Number.isFinite(row[metric]), metric);
    samples.push({
      page: key, collection, route, id: row.id, time: row.time, device: row.device,
      temperature: row.temperature, side: row.side, repeat: row.repeat,
      ttfb: row.ttfb, htmlEndMs: document.networkEndTime,
      posterRequestStartMs: poster?.rendererStartTime ?? null,
      posterFetchMs: phases.find(item => item.phase === 'resourceLoadDuration')?.duration ?? null,
      posterCache: imageHeaders['x-vercel-cache'] ?? null, posterFromDiskCache: imageResponse?.fromDiskCache ?? false,
      fcp: row.fcp, lcp: row.lcp, cls: row.cls, tbt: row.tbt, bytes: row.bytes,
      score: row.score, lcpSelector: lcpNode.selector, lcpRect: lcpNode.boundingRect,
      frame: row.reader.frame, cache: headers['x-vercel-cache'],
      responseCacheControl: headers['cache-control'], vercelId: headers['x-vercel-id'],
      networkUserAgent: lhr.environment.networkUserAgent,
      benchmarkIndex: lhr.environment.benchmarkIndex,
      posterStatus: poster?.statusCode ?? null, posterPriority: poster?.priority ?? null,
    });
  }
  for (const device of devices) for (const temperature of temperatures) {
    const sides = {};
    for (const side of ['baseline', 'candidate']) {
      const rows = samples.filter(row => row.page === key && row.collection === collection && row.device === device && row.temperature === temperature && row.side === side);
      assert.equal(rows.length, repeats);
      const stats = {};
      for (const metric of metrics) {
        const values = rows.map(row => row[metric]).filter(value => value !== null);
        stats[metric] = values.length ? {n: values.length, median: median(values), min: Math.min(...values), max: Math.max(...values)} : null;
      }
      sides[side] = stats;
    }
    const group = {page: key, collection, device, temperature, nPerVersion: repeats, ...sides,
      lcpChangePercent: (sides.candidate.lcp.median / sides.baseline.lcp.median - 1) * 100,
      htmlEndChangeMs: sides.candidate.htmlEndMs.median - sides.baseline.htmlEndMs.median,
    };
    groups.push(group);
    console.log(JSON.stringify({page: key, collection, device, temperature, before: group.baseline.lcp.median, after: group.candidate.lcp.median, changePercent: group.lcpChangePercent, clsMax: group.candidate.cls.max}));
    for (let repeat = 1; repeat <= repeats; repeat++) {
      const pair = ['baseline', 'candidate'].map(side => raw.find(row => row.device === device && row.temperature === temperature && row.side === side && row.repeat === repeat));
      assert.deepEqual(pair[0].reader.video, pair[1].reader.video, 'media attributes unchanged');
      assert.deepEqual(pair[0].reader.quotes, pair[1].reader.quotes, 'complete displayed quotes unchanged');
      assert.equal(pair[0].reader.canonical, pair[1].reader.canonical);
      for (const dimension of ['width', 'height']) assert.ok(Math.abs(pair[0].reader.frame[dimension] - pair[1].reader.frame[dimension]) <= 0.01, 'reader geometry unchanged');
      paired.push({page: key, collection, device, temperature, repeat, lcpDeltaMs: pair[1].lcp - pair[0].lcp, clsDelta: pair[1].cls - pair[0].cls});
    }
  }
}
assert.equal(samples.length, 90);
const columns = ['page', 'collection', 'route', 'id', 'time', 'device', 'temperature', 'side', 'repeat', ...metrics, 'score', 'cache', 'posterCache', 'lcpSelector'];
const csv = value => value == null ? '' : '"' + String(value).replaceAll('"', '""') + '"';
fs.writeFileSync(path.join(report, 'multipage-samples.csv'), columns.join(',') + '\n' + samples.map(row => columns.map(key => csv(row[key])).join(',')).join('\n') + '\n');
fs.writeFileSync(path.join(report, 'multipage-samples.json'), JSON.stringify(samples, null, 2) + '\n');
fs.writeFileSync(path.join(report, 'multipage-summary.json'), JSON.stringify({groups, paired}, null, 2) + '\n');
console.log(JSON.stringify({audits: samples.length, improvedPairs: paired.filter(row => row.lcpDeltaMs < 0).length, totalPairs: paired.length, documentCache: [...new Set(samples.map(row => row.cache))], mobileClsMax: Math.max(...samples.filter(row => row.device === 'mobile').map(row => row.cls))}));
