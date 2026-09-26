const key = row => JSON.stringify([row.route, row.deviceType]);

export function summarizeVercelMetric(metric, values, counts) {
  for (const data of [values, counts]) {
    if (!data?.query || !Array.isArray(data.summary)) throw new Error('Invalid Vercel metric response');
  }
  for (const field of ['metric', 'groupBy', 'startTime', 'endTime', 'filter']) {
    if (JSON.stringify(values.query[field]) !== JSON.stringify(counts.query[field])) {
      throw new Error('Vercel scope/window mismatch: ' + field);
    }
  }
  if (values.query.metric !== 'vercel.speed_insights.' + metric
    || values.query.aggregation !== 'p75' || counts.query.aggregation !== 'count'
    || JSON.stringify(values.query.groupBy) !== JSON.stringify(['route', 'deviceType'])) {
    throw new Error('Unexpected Vercel metric scope or aggregation');
  }
  const countByRoute = new Map(counts.summary.map(row => [key(row), row['vercel_speed_insights_' + metric + '_count']]));
  return values.summary.map(row => ({
    metric, unit: metric === 'cls' ? 'score' : 'ms', route: row.route, device: row.deviceType,
    p75: row['vercel_speed_insights_' + metric + '_p75'] ?? null,
    count: countByRoute.get(key(row)) ?? null,
    startTime: values.query.startTime, endTime: values.query.endTime, filter: values.query.filter,
  }));
}
