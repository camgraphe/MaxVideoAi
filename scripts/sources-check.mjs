import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DATASET_PATH = path.join(ROOT, 'data', 'benchmarks', 'engine-key-specs.v1.json');
const REPORTS_DIR = path.join(ROOT, '.reports');
const REPORT_PATH = path.join(REPORTS_DIR, 'sources-check.json');

const TIMEOUT_MS = 12_000;
const MAX_RETRY = 1;
const CONCURRENCY = 5;

function parseArgs(argv) {
  let maxDead = 0;
  argv.forEach((arg, index) => {
    if (arg.startsWith('--max-dead=')) {
      const parsed = Number(arg.split('=')[1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        maxDead = parsed;
      }
    }
    if (arg === '--max-dead') {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        maxDead = parsed;
      }
    }
  });
  return {
    strict: argv.includes('--strict'),
    maxDead,
  };
}

async function loadDataset() {
  const raw = await fs.readFile(DATASET_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  const specs = Array.isArray(parsed?.specs) ? parsed.specs : [];
  return specs;
}

function classifyHttpStatus(status, timedOut = false, networkError = false) {
  if (timedOut || networkError) return 'dead';
  if (status === 200 || status === 204) return 'ok';
  if (status === 301 || status === 302) return 'redirect';
  if (status === 403 || status === 429) return 'blocked';
  if (status === 404 || status === 410) return 'dead';
  if (status >= 500) return 'dead';
  return 'dead';
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
    });
    return {
      ok: true,
      status: response.status,
      finalUrl: response.headers.get('location') ?? null,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return { ok: false, timeout: true, error: 'timeout' };
    }
    return { ok: false, timeout: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRetry(url, method) {
  let attempt = 0;
  let lastResult = null;
  while (attempt <= MAX_RETRY) {
    const result = await fetchWithTimeout(url, method);
    lastResult = result;
    if (result.ok) return result;
    if (result.timeout) {
      attempt += 1;
      continue;
    }
    if (typeof result.error === 'string' && /network|socket|ecconn|econn|enotfound|timed? out|fetch failed/i.test(result.error)) {
      attempt += 1;
      continue;
    }
    return result;
  }
  return lastResult;
}

async function checkUrl(url) {
  const headResult = await requestWithRetry(url, 'HEAD');
  if (headResult?.ok) {
    const headClassification = classifyHttpStatus(headResult.status);
    if (headClassification === 'ok' || headClassification === 'redirect' || headClassification === 'blocked') {
      return {
        url,
        method: 'HEAD',
        status: headResult.status,
        category: headClassification,
        location: headResult.finalUrl,
      };
    }
  }

  const getResult = await requestWithRetry(url, 'GET');
  if (getResult?.ok) {
    return {
      url,
      method: 'GET',
      status: getResult.status,
      category: classifyHttpStatus(getResult.status),
      location: getResult.finalUrl,
    };
  }

  const timeout = Boolean(getResult?.timeout || headResult?.timeout);
  return {
    url,
    method: getResult ? 'GET' : 'HEAD',
    status: null,
    category: classifyHttpStatus(0, timeout, true),
    location: null,
    error: getResult?.error ?? headResult?.error ?? 'network error',
  };
}

async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function buildDomainStats(results) {
  const counts = new Map();
  results.forEach((entry) => {
    if (entry.category !== 'dead') return;
    try {
      const host = new URL(entry.url).hostname.toLowerCase();
      counts.set(host, (counts.get(host) ?? 0) + 1);
    } catch {
      // Ignore invalid URLs in domain aggregation.
    }
  });
  return Array.from(counts.entries())
    .map(([domain, deadCount]) => ({ domain, deadCount }))
    .sort((a, b) => b.deadCount - a.deadCount)
    .slice(0, 10);
}

async function writeReport(report) {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}

async function main() {
  const { strict, maxDead } = parseArgs(process.argv.slice(2));
  const specs = await loadDataset();
  const urlsMap = new Map();

  specs.forEach((entry) => {
    const modelSlug = typeof entry?.modelSlug === 'string' ? entry.modelSlug : 'unknown';
    const sources = Array.isArray(entry?.sources) ? entry.sources : [];
    sources.forEach((value) => {
      if (typeof value !== 'string') return;
      const url = value.trim();
      if (!/^https?:\/\//i.test(url)) return;
      const list = urlsMap.get(url) ?? [];
      list.push(modelSlug);
      urlsMap.set(url, list);
    });
  });

  const uniqueUrls = Array.from(urlsMap.keys());
  const results = await runWithConcurrency(
    uniqueUrls,
    async (url) => {
      const result = await checkUrl(url);
      return {
        ...result,
        models: Array.from(new Set(urlsMap.get(url) ?? [])).sort((a, b) => a.localeCompare(b, 'en')),
      };
    },
    CONCURRENCY
  );

  const summary = {
    total: results.length,
    ok: results.filter((entry) => entry.category === 'ok').length,
    redirect: results.filter((entry) => entry.category === 'redirect').length,
    blocked: results.filter((entry) => entry.category === 'blocked').length,
    dead: results.filter((entry) => entry.category === 'dead').length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    strict,
    maxDead,
    summary,
    topDeadDomains: buildDomainStats(results),
    results,
  };

  await writeReport(report);

  console.table([
    { metric: 'total', value: summary.total },
    { metric: 'ok', value: summary.ok },
    { metric: 'redirect', value: summary.redirect },
    { metric: 'blocked', value: summary.blocked },
    { metric: 'dead', value: summary.dead },
  ]);

  if (report.topDeadDomains.length) {
    console.log('[sources:check] Top dead domains:');
    console.table(report.topDeadDomains);
  }

  if (!strict) {
    if (summary.dead > 0 || summary.blocked > 0) {
      console.warn(
        `[sources:check] Warn-only mode: dead=${summary.dead}, blocked=${summary.blocked}. Report: .reports/sources-check.json`
      );
    } else {
      console.log('[sources:check] All sources reachable. Report: .reports/sources-check.json');
    }
    return;
  }

  if (summary.dead > maxDead) {
    console.error(
      `[sources:check] Strict mode failed: dead=${summary.dead} exceeds max-dead=${maxDead}. Report: .reports/sources-check.json`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[sources:check] Strict mode passed (dead=${summary.dead}, max-dead=${maxDead}).`);
}

main().catch((error) => {
  console.error('[sources:check] Failed:', error);
  process.exitCode = 1;
});
