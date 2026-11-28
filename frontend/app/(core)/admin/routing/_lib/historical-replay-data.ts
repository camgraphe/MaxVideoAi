import { readFile, stat } from 'node:fs/promises';
import { isKlingDirectV3Funded } from '@/server/video-providers/router';
import { buildHistoricalReplay } from './historical-replay';
import { loadHistoricalReplayGroups } from './historical-replay-query';
import type { HistoricalReplayGroup } from './historical-replay-types';

type Dataset = {
  startDay: string;
  endDay: string;
  capturedAt: string;
  groups: HistoricalReplayGroup[];
};

const madridDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const filterPattern = /^[a-zA-Z0-9_-]{1,120}$/;
const cacheMs = 5 * 60_000;

export function replayPeriod(now: Date): { startDay: string; endDay: string } {
  const endDay = madridDay.format(now);
  const start = new Date(endDay + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - 30);
  return { startDay: start.toISOString().slice(0, 10), endDay };
}

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function replayFilters(params: URLSearchParams) {
  const engineId = params.get('engine') || undefined;
  const status = params.get('status') || undefined;
  const day = params.get('date') || undefined;
  const source = params.get('source') ?? 'default';
  const tariff = params.get('tariff') ?? 'list';
  const limit = params.get('limit') ?? '50';
  const offset = params.get('offset') ?? '0';
  const pageSize = Number(limit), skip = Number(offset);
  if ((engineId && !filterPattern.test(engineId)) || (status && !filterPattern.test(status)) ||
      (day && !isDay(day)) || !['default', 'database'].includes(source) ||
      !['list', 'alibaba-discount'].includes(tariff) || !/^\d+$/.test(limit) || !/^\d+$/.test(offset) ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      !Number.isSafeInteger(skip) || skip < 0 || skip % pageSize !== 0) return null;
  return { engineId, status, day, useDatabase: source === 'database', alibabaStandardDiscount: tariff === 'alibaba-discount',
    page: 1 + skip / pageSize, pageSize };
}

async function readArchive(path: string): Promise<Dataset> {
  const archive = JSON.parse(await readFile(path, 'utf8'));
  if (archive.version !== 1 || !isDay(archive.startDay) || !isDay(archive.endDay) ||
      Date.parse(archive.endDay) - Date.parse(archive.startDay) !== 30 * 86_400_000 ||
      !Array.isArray(archive.groups) || !Number.isFinite(Date.parse(archive.capturedAt))) {
    throw new Error('Invalid local routing replay archive');
  }
  return archive;
}

// Caches the same admin-wide source across pages. Browser responses remain private and uncached.
// A rejected read must not suppress a later retry. Only these two server-selected keys are retained.
const sources: Partial<Record<'archive' | 'database', { key: string; until: number; data: Promise<Dataset> }>> = {};

export async function readHistoricalReplay(filters: NonNullable<ReturnType<typeof replayFilters>>) {
  const now = new Date();
  const { startDay, endDay } = replayPeriod(now);
  const archivePath = !filters.useDatabase && process.env.NODE_ENV === 'development' && !process.env.VERCEL
    ? process.env.VIDEO_ROUTING_REPLAY_ARCHIVE : undefined;
  const source = archivePath ? 'archive' : 'database';
  // An operator can replace the local capture atomically while the preview is running.
  const file = archivePath ? await stat(archivePath) : null;
  const key = file ? [archivePath, file.ino, file.size, file.mtimeMs].join('/') : endDay;
  let entry = sources[source];
  if (!entry || entry.key !== key || entry.until <= now.getTime()) {
    const data = archivePath ? readArchive(archivePath) : loadHistoricalReplayGroups(startDay, endDay)
      .then(groups => ({ startDay, endDay, capturedAt: now.toISOString(), groups }));
    entry = { key, until: now.getTime() + cacheMs, data };
    sources[source] = entry;
    void data.catch(() => { if (sources[source]?.data === data) delete sources[source]; });
  }
  const data = await entry.data;
  const groups = data.groups.filter(row => (!filters.status || row.status === filters.status) &&
    (!filters.day || (row.bucketAt && madridDay.format(new Date(row.bucketAt)) === filters.day)));
  return {
    source, startDay: data.startDay, endDay: data.endDay, capturedAt: data.capturedAt,
    engineOptions: [...new Set(data.groups.map(row => row.engineId))].sort(),
    statusOptions: [...new Set(data.groups.map(row => row.status))].sort(),
    report: buildHistoricalReplay(groups, { ...filters, klingDirectFunded: isKlingDirectV3Funded() }),
  };
}
