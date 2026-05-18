import process from 'node:process';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';
import type { VideoSeoAuditReport } from '@/server/video-seo-audit';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

function parseLimit(): number {
  const raw = process.argv.find((arg) => arg.startsWith('--limit='))?.slice('--limit='.length) ?? process.env.VIDEO_SEO_AUDIT_LIMIT;
  const value = raw ? Number.parseInt(raw, 10) : 1000;
  return Number.isFinite(value) && value > 0 ? value : 1000;
}

function printTextReport(report: VideoSeoAuditReport) {
  console.log(`Video SEO watch-page audit generated at ${report.generatedAt}`);
  console.log(
    `total=${report.summary.total} keep_indexable=${report.summary.keep_indexable} needs_enrichment=${report.summary.needs_enrichment} deindex=${report.summary.deindex} duplicate_or_conflict=${report.summary.duplicate_or_conflict}`
  );
  for (const row of report.rows) {
    console.log(
      [
        row.videoId,
        row.classification,
        `seoStatus=${row.seoStatus}`,
        `robots=${row.robots}`,
        `canonical=${row.canonicalUrl ?? 'missing'}`,
        `videoSitemap=${row.videoSitemapIncluded ? 'yes' : 'no'}`,
        `media=${row.mediaGateResult}`,
        `links=${row.internalLinkCount ?? 'unknown'}`,
      ].join(' | ')
    );
    if (row.blockers.length) {
      console.log(`  blockers: ${row.blockers.join('; ')}`);
    }
  }
}

async function main() {
  const { buildVideoSeoAuditReport } = await import('@/server/video-seo-audit');
  const { listVideoSeoAuditSourceRows } = await import('@/server/video-seo-audit-source');
  const rows = await listVideoSeoAuditSourceRows(parseLimit());
  const report = buildVideoSeoAuditReport(rows);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printTextReport(report);
}

void main().catch((error) => {
  console.error('[video-watch-pages-audit] failed', error);
  process.exit(1);
});
