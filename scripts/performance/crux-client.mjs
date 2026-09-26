const METRICS = [
  'largest_contentful_paint', 'interaction_to_next_paint', 'cumulative_layout_shift',
  'first_contentful_paint', 'experimental_time_to_first_byte', 'round_trip_time',
  'largest_contentful_paint_resource_type', 'navigation_types',
  'largest_contentful_paint_image_time_to_first_byte',
  'largest_contentful_paint_image_resource_load_delay',
  'largest_contentful_paint_image_resource_load_duration',
  'largest_contentful_paint_image_element_render_delay',
];

function numeric(value) {
  if (value === undefined || value === null || value === 'NaN') return null;
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Invalid numeric metric');
  if (value === '' || !Number.isFinite(Number(value))) throw new Error('Invalid numeric metric');
  return Number(value);
}

function isoDate(value) {
  if (!value || !Number.isInteger(value.year) || !Number.isInteger(value.month) || !Number.isInteger(value.day)) throw new Error('Missing collection date');
  const date = [value.year, String(value.month).padStart(2, '0'), String(value.day).padStart(2, '0')].join('-');
  if (new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Invalid collection date');
  return date;
}

export function normalizeCruxResponse(requested, raw) {
  const record = raw?.record;
  const key = record?.key;
  if (!record || !key) return { status: 'error', reason: 'missing-record', rows: [] };
  const actualScope = key.url ? 'url' : key.origin ? 'origin' : null;
  if (actualScope !== requested.scope || key.formFactor !== requested.formFactor ||
      (requested.scope === 'origin' && key.origin !== requested.target)) {
    return { status: 'scope-mismatch', actualKey: key, rows: [] };
  }
  const history = Array.isArray(record.collectionPeriods);
  const periods = history ? record.collectionPeriods : [record.collectionPeriod];
  if (!periods.length) throw new Error('Missing collection periods');
  const rows = [];
  for (const [index, period] of periods.entries()) {
    for (const metric of METRICS) {
      const data = record.metrics?.[metric];
      const p75 = numeric(history ? data?.percentilesTimeseries?.p75s?.[index] : data?.percentiles?.p75);
      const histogram = history
        ? data?.histogramTimeseries?.map(({ start, end, densities }) => ({ start, ...(end === undefined ? {} : { end }), density: numeric(densities?.[index]) })) ?? null
        : data?.histogram ?? null;
      const fractions = history
        ? data?.fractionTimeseries && Object.fromEntries(Object.entries(data.fractionTimeseries).map(([name, series]) => [name, numeric(series.fractions?.[index])]))
        : data?.fractions;
      rows.push({
        firstDate: isoDate(period.firstDate), lastDate: isoDate(period.lastDate), metric,
        unit: metric === 'cumulative_layout_shift' ? 'unitless' : metric.endsWith('_type') || metric === 'navigation_types' ? 'fraction' : 'ms',
        p75, histogram, fractions: fractions ?? null,
      });
    }
  }
  return { status: 'ok', actualKey: key, urlNormalizationDetails: raw.urlNormalizationDetails ?? null, rows };
}

export async function queryCrux(requested, { apiKey, history = false, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('CRUX_API_KEY is required');
  if (!['origin', 'url'].includes(requested.scope) || !['PHONE', 'DESKTOP', 'TABLET'].includes(requested.formFactor)) throw new Error('Invalid query dimensions');
  const endpoint = new URL('https://chromeuxreport.googleapis.com/v1/records:' + (history ? 'queryHistoryRecord' : 'queryRecord'));
  endpoint.searchParams.set('key', apiKey);
  const body = { [requested.scope]: requested.target, formFactor: requested.formFactor, ...(history ? { collectionPeriodCount: 40 } : {}) };
  const base = { requested, mode: history ? 'history' : 'daily', retrievedAt: new Date().toISOString() };
  try {
    const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const raw = await response.json();
    if (!response.ok) {
      return { ...base, status: response.status === 404 && raw?.error?.status === 'NOT_FOUND' ? 'no-data' : 'error', httpStatus: response.status, errorStatus: raw?.error?.status ?? 'UNKNOWN', rows: [] };
    }
    return { ...base, ...normalizeCruxResponse(requested, raw), raw };
  } catch {
    // Do not leak credentials through fetch exception URLs or substitute origin data.
    return { ...base, status: 'error', errorStatus: 'FETCH_OR_DATA_ERROR', rows: [] };
  }
}

